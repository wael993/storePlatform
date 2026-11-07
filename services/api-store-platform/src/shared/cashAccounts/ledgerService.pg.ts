/**
 * Postgres port of `ledgerService.ts` (PG-MIG-2, group 1). Same exports and
 * rules; `session` becomes `tx`. Replaces the Mongo file in the group-1 switch.
 *
 * Differences on purpose:
 * - Idempotent inserts use ON CONFLICT DO NOTHING, so a replay never aborts the transaction.
 * - Every multi-row write runs in a transaction even when the caller passes none.
 * - Balances are exact `numeric` sums (Mongo `$inc` on doubles could drift in the last digit).
 */
import { and, asc, desc, eq, gte, inArray, lte, sql, SQL } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

import {
	AuditActor,
	createdByColumns,
	createdByOf,
	DbTx,
	Executor,
	getDb,
	inTransaction,
	num,
	requireTenantId,
} from '../../db'
import {
	buyingInvoices,
	cashAccountBalances,
	cashAccounts,
	cashLedgerEntries,
	dailyActions,
	invoices,
} from '../../db/schema'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import { addCashBalances, currencyBalanceOf } from '../store-domain/cashTender'
import { getTenantContext } from '../tenant'
import type { RequestContext } from '../types'
import { reversedCashPost } from './cashImpact'
import {
	buildActor,
	CashBalanceByType,
	CashLedgerListEntry,
	clampLedgerLimit,
	clampLedgerPage,
	parseLedgerDateBound,
} from './ledgerService'
import {
	CASH_ACCOUNT_DEFAULT_NAMES,
	CASH_MOVEMENT_TYPES,
	CASH_REFERENCE_TYPES,
	INITIAL_CASH_ACCOUNT_TYPES,
	validateCashExchangeInput,
	validateCashTransferInput,
	type CashAccountType,
	type DesiredCashPost,
} from './types'

export {
	buildActor,
	clampLedgerLimit,
	clampLedgerPage,
	parseLedgerDateBound,
} from './ledgerService'
export type { CashBalanceByType, CashLedgerListEntry } from './ledgerService'

type Actor = AuditActor & { createdAt: Date }

const roundPrimary = (amount: number) => Math.round(amount * 1e8) / 1e8

const systemActor = (): Actor => ({
	_id: 'system',
	displayName: 'System',
	role: 'system',
	createdAt: new Date(),
})

const fail = (message: string) =>
	new BusinessLogicError(
		ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
		message,
	)

const currencyKey = (currencyId: string) => {
	const id = currencyId.trim()

	if (!id || id.includes('.') || id.includes('$')) {
		throw fail('Cash currency is invalid.')
	}

	return id
}

const balancesOf = async (
	db: Executor,
	tenantId: string,
	cashAccountIds: string[],
) => {
	const byAccount = new Map<string, Record<string, number>>()

	if (!cashAccountIds.length) return byAccount

	const rows = await db
		.select()
		.from(cashAccountBalances)
		.where(
			and(
				eq(cashAccountBalances.tenantId, tenantId),
				inArray(cashAccountBalances.cashAccountId, cashAccountIds),
			),
		)

	for (const row of rows) {
		const balances = byAccount.get(row.cashAccountId) ?? {}

		balances[row.currencyId] = Number(row.amount)
		byAccount.set(row.cashAccountId, balances)
	}

	return byAccount
}

export const ensureCashAccountsForWarehouse = async (
	tenantId: string,
	warehouseId: string,
	actor: Actor = systemActor(),
	tx?: DbTx,
) => {
	const db = tx ?? getDb()
	const scopedTenant = requireTenantId(tenantId)

	await db
		.insert(cashAccounts)
		.values(
			INITIAL_CASH_ACCOUNT_TYPES.map(type => {
				const cashAccountId = uuidv4()

				return {
					id: cashAccountId,
					tenantId: scopedTenant,
					cashAccountId,
					warehouseId,
					type,
					name: CASH_ACCOUNT_DEFAULT_NAMES[type],
					isActive: true,
					allowNegativeBalance: false,
					...createdByColumns(actor),
				}
			}),
		)
		.onConflictDoNothing({
			target: [
				cashAccounts.tenantId,
				cashAccounts.warehouseId,
				cashAccounts.type,
			],
		})

	const accounts = await db
		.select()
		.from(cashAccounts)
		.where(
			and(
				eq(cashAccounts.tenantId, scopedTenant),
				eq(cashAccounts.warehouseId, warehouseId),
				inArray(cashAccounts.type, [...INITIAL_CASH_ACCOUNT_TYPES]),
			),
		)
	const balances = await balancesOf(
		db,
		scopedTenant,
		accounts.map(account => account.cashAccountId),
	)

	return accounts.map(account => ({
		...account,
		balances: balances.get(account.cashAccountId) ?? {},
	}))
}

const getAccountOrThrow = async (
	tenantId: string,
	warehouseId: string,
	accountType: string,
	tx: DbTx,
) => {
	await ensureCashAccountsForWarehouse(tenantId, warehouseId, systemActor(), tx)

	const [account] = await tx
		.select()
		.from(cashAccounts)
		.where(
			and(
				eq(cashAccounts.tenantId, tenantId),
				eq(cashAccounts.warehouseId, warehouseId),
				eq(cashAccounts.type, accountType),
				eq(cashAccounts.isActive, true),
			),
		)

	if (!account) {
		throw fail(
			`Cash account ${accountType} not found for warehouse ${warehouseId}.`,
		)
	}

	return account
}

const addToBalance = (
	tx: DbTx,
	tenantId: string,
	cashAccountId: string,
	currencyId: string,
	delta: number,
) =>
	tx
		.insert(cashAccountBalances)
		.values({ tenantId, cashAccountId, currencyId, amount: String(delta) })
		.onConflictDoUpdate({
			target: [
				cashAccountBalances.tenantId,
				cashAccountBalances.cashAccountId,
				cashAccountBalances.currencyId,
			],
			set: { amount: sql`${cashAccountBalances.amount} + excluded.amount` },
		})

/**
 * Apply a signed amount to one currency on an account. A missing balance is
 * zero. A debit cannot spend a different currency.
 */
const applyBalanceDelta = async (
	tenantId: string,
	cashAccountId: string,
	currencyId: string,
	delta: number,
	tx: DbTx,
) => {
	const rounded = roundPrimary(delta)

	if (rounded === 0) return

	const key = currencyKey(currencyId)

	if (rounded > 0) {
		await addToBalance(tx, tenantId, cashAccountId, key, rounded)

		return
	}

	const [account] = await tx
		.select({
			name: cashAccounts.name,
			allowNegativeBalance: cashAccounts.allowNegativeBalance,
		})
		.from(cashAccounts)
		.where(
			and(
				eq(cashAccounts.tenantId, tenantId),
				eq(cashAccounts.cashAccountId, cashAccountId),
			),
		)

	if (account?.allowNegativeBalance) {
		await addToBalance(tx, tenantId, cashAccountId, key, rounded)

		return
	}

	// Guarded debit: only when the same currency covers it (row lock via UPDATE).
	const updated = await tx
		.update(cashAccountBalances)
		.set({ amount: sql`${cashAccountBalances.amount} + ${String(rounded)}` })
		.where(
			and(
				eq(cashAccountBalances.tenantId, tenantId),
				eq(cashAccountBalances.cashAccountId, cashAccountId),
				eq(cashAccountBalances.currencyId, key),
				sql`${cashAccountBalances.amount} + ${String(rounded)} >= 0`,
			),
		)
		.returning({ amount: cashAccountBalances.amount })

	if (updated.length) return

	const balances = await balancesOf(tx, tenantId, [cashAccountId])
	const available = currencyBalanceOf(balances.get(cashAccountId) ?? {}, key)

	throw fail(
		`Amount exceeds available balance in ${account?.name ?? cashAccountId} (${available.toFixed(2)} ${key}).`,
	)
}

const insertLedgerEntry = async (
	params: {
		tenantId: string
		warehouseId: string
		cashAccountId: string
		accountType: string
		currencyId: string
		amount: number
		movementType: string
		referenceType: string
		referenceId: string
		idempotencyKey: string
		actor: Actor
		transferGroupId?: string
		reversesLedgerEntryId?: string
		reason?: string
		fromExchangeRateToPrimary?: number
		toExchangeRateToPrimary?: number
	},
	tx: DbTx,
) => {
	const ledgerEntryId = uuidv4()
	const inserted = await tx
		.insert(cashLedgerEntries)
		.values({
			id: ledgerEntryId,
			tenantId: params.tenantId,
			ledgerEntryId,
			warehouseId: params.warehouseId,
			cashAccountId: params.cashAccountId,
			accountType: params.accountType,
			currencyId: currencyKey(params.currencyId),
			amount: String(roundPrimary(params.amount)),
			movementType: params.movementType,
			referenceType: params.referenceType,
			referenceId: params.referenceId,
			idempotencyKey: params.idempotencyKey,
			transferGroupId: params.transferGroupId,
			reversesLedgerEntryId: params.reversesLedgerEntryId,
			reason: params.reason,
			fromExchangeRateToPrimary: optionalNumeric(
				params.fromExchangeRateToPrimary,
			),
			toExchangeRateToPrimary: optionalNumeric(params.toExchangeRateToPrimary),
			...createdByColumns(params.actor),
		})
		// Duplicate idempotencyKey = successful retry; does not abort the transaction.
		.onConflictDoNothing({
			target: [cashLedgerEntries.tenantId, cashLedgerEntries.idempotencyKey],
		})
		.returning({ ledgerEntryId: cashLedgerEntries.ledgerEntryId })

	return { duplicate: inserted.length === 0 }
}

const optionalNumeric = (value: number | undefined) =>
	value === undefined ? undefined : String(value)

const postSingleEffect = async (
	params: {
		tenantId: string
		warehouseId: string
		post: DesiredCashPost
		referenceType: string
		referenceId: string
		idempotencyKey: string
		actor: Actor
		reason?: string
		transferGroupId?: string
		fromExchangeRateToPrimary?: number
		toExchangeRateToPrimary?: number
	},
	tx: DbTx,
) => {
	const account = await getAccountOrThrow(
		params.tenantId,
		params.warehouseId,
		params.post.accountType,
		tx,
	)
	const inserted = await insertLedgerEntry(
		{
			tenantId: params.tenantId,
			warehouseId: params.warehouseId,
			cashAccountId: account.cashAccountId,
			accountType: params.post.accountType,
			currencyId: params.post.currencyId,
			amount: params.post.amount,
			movementType: params.post.movementType,
			referenceType: params.referenceType,
			referenceId: params.referenceId,
			idempotencyKey: params.idempotencyKey,
			actor: params.actor,
			reason: params.reason,
			transferGroupId: params.transferGroupId,
			fromExchangeRateToPrimary: params.fromExchangeRateToPrimary,
			toExchangeRateToPrimary: params.toExchangeRateToPrimary,
		},
		tx,
	)

	if (inserted.duplicate) return

	await applyBalanceDelta(
		params.tenantId,
		account.cashAccountId,
		params.post.currencyId,
		params.post.amount,
		tx,
	)
}

const listActiveEffectsForReference = async (
	tenantId: string,
	referenceType: string,
	referenceId: string,
	tx: DbTx,
) => {
	const entries = await tx
		.select()
		.from(cashLedgerEntries)
		.where(
			and(
				eq(cashLedgerEntries.tenantId, tenantId),
				eq(cashLedgerEntries.referenceType, referenceType),
				eq(cashLedgerEntries.referenceId, referenceId),
			),
		)
		.orderBy(asc(cashLedgerEntries.createdAt), asc(cashLedgerEntries.id))
	const reversedIds = new Set(
		entries
			.map(entry => entry.reversesLedgerEntryId)
			.filter((id): id is string => Boolean(id)),
	)

	return entries
		.filter(
			entry =>
				entry.movementType !== CASH_MOVEMENT_TYPES.REVERSAL &&
				!reversedIds.has(entry.ledgerEntryId),
		)
		.map(entry => ({ ...entry, amount: Number(entry.amount) }))
}

const postsMatch = (left: DesiredCashPost[], right: DesiredCashPost[]) => {
	if (left.length !== right.length) return false

	const normalize = (posts: DesiredCashPost[]) =>
		[...posts]
			.map(post => ({
				accountType: post.accountType,
				currencyId: post.currencyId,
				amount: roundPrimary(post.amount),
				movementType: post.movementType,
			}))
			.sort((a, b) =>
				`${a.accountType}:${a.currencyId}:${a.movementType}:${a.amount}`.localeCompare(
					`${b.accountType}:${b.currencyId}:${b.movementType}:${b.amount}`,
				),
			)
	const a = normalize(left)
	const b = normalize(right)

	return a.every(
		(post, index) =>
			post.accountType === b[index]?.accountType &&
			post.currencyId === b[index]?.currencyId &&
			post.amount === b[index]?.amount &&
			post.movementType === b[index]?.movementType,
	)
}

/**
 * Sync ledger effects for a business document to `desired` posts.
 * Reverses prior active effects when they differ, then posts the new set.
 */
export const syncCashEffectsForReference = (params: {
	requestContext?: RequestContext
	tenantId: string
	warehouseId: string
	referenceType: string
	referenceId: string
	desired: DesiredCashPost[]
	reason?: string
	tx?: DbTx
	actor?: Actor
}) =>
	inTransaction(params.tx, async tx => {
		const actor =
			params.actor ??
			(params.requestContext
				? buildActor(params.requestContext)
				: systemActor())
		const { warehouseId, referenceType, referenceId } = params
		const tenantId = requireTenantId(params.tenantId)

		await ensureCashAccountsForWarehouse(tenantId, warehouseId, actor, tx)

		const active = await listActiveEffectsForReference(
			tenantId,
			referenceType,
			referenceId,
			tx,
		)
		const currentAsDesired: DesiredCashPost[] = active.map(entry => ({
			accountType: entry.accountType as CashAccountType,
			currencyId: entry.currencyId?.trim() || '',
			amount: entry.amount,
			movementType: entry.movementType as DesiredCashPost['movementType'],
		}))

		if (postsMatch(currentAsDesired, params.desired)) {
			return
		}

		for (const entry of active) {
			const reversed = reversedCashPost({
				accountType: entry.accountType as CashAccountType,
				currencyId: entry.currencyId ?? '',
				amount: entry.amount,
				movementType: entry.movementType as DesiredCashPost['movementType'],
			})
			const inserted = await insertLedgerEntry(
				{
					tenantId,
					warehouseId: entry.warehouseId,
					cashAccountId: entry.cashAccountId,
					accountType: entry.accountType,
					currencyId: reversed.currencyId,
					amount: reversed.amount,
					movementType: reversed.movementType,
					referenceType,
					referenceId,
					idempotencyKey: `rev:${entry.ledgerEntryId}`,
					actor,
					reversesLedgerEntryId: entry.ledgerEntryId,
					reason: params.reason ?? 'تم تعديل او حذف الفاتورة',
				},
				tx,
			)

			if (!inserted.duplicate) {
				await applyBalanceDelta(
					tenantId,
					entry.cashAccountId,
					reversed.currencyId,
					reversed.amount,
					tx,
				)
			}
		}

		for (const [index, post] of params.desired.entries()) {
			const amountKey = roundPrimary(post.amount)

			await postSingleEffect(
				{
					tenantId,
					warehouseId,
					post,
					referenceType,
					referenceId,
					idempotencyKey: `${referenceType}:${referenceId}:${post.accountType}:${post.currencyId}:${post.movementType}:${amountKey}:n${index}`,
					actor,
					reason: params.reason,
				},
				tx,
			)
		}
	})

const validated = <T>(validate: () => T, fallback: string): T => {
	try {
		return validate()
	} catch (error) {
		throw fail(error instanceof Error ? error.message : fallback)
	}
}

/** Internal transfer helper — both legs in one transaction. */
export const postInternalCashTransfer = async (params: {
	requestContext: RequestContext
	warehouseId: string
	fromAccountType: CashAccountType
	toAccountType: CashAccountType
	amount: number
	currencyId: string
	reason?: string
	tx?: DbTx
}) => {
	const { fromAccountType, toAccountType, amount } = validated(
		() =>
			validateCashTransferInput({
				fromAccountType: params.fromAccountType,
				toAccountType: params.toAccountType,
				amount: params.amount,
			}),
		'Invalid transfer.',
	)
	const tenantId = getTenantContext(params.requestContext).tenantId
	const actor = buildActor(params.requestContext)
	const currencyId = currencyKey(params.currencyId)
	const transferId = uuidv4()
	const leg = (
		accountType: CashAccountType,
		signed: number,
		side: 'from' | 'to',
	) => ({
		tenantId,
		warehouseId: params.warehouseId,
		post: {
			accountType,
			currencyId,
			amount: signed,
			movementType: CASH_MOVEMENT_TYPES.TRANSFER,
		},
		referenceType: CASH_REFERENCE_TYPES.TRANSFER,
		referenceId: transferId,
		idempotencyKey: `${CASH_REFERENCE_TYPES.TRANSFER}:${transferId}:${side}`,
		actor,
		reason: params.reason,
		transferGroupId: transferId,
	})

	return inTransaction(params.tx, async tx => {
		await ensureCashAccountsForWarehouse(
			tenantId,
			params.warehouseId,
			actor,
			tx,
		)

		await postSingleEffect(leg(fromAccountType, -amount, 'from'), tx)
		await postSingleEffect(leg(toAccountType, amount, 'to'), tx)

		return { transferId }
	})
}

const EXCHANGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

/**
 * Same-account currency exchange: −fromAmount in fromCurrency, +toAmount in
 * toCurrency, one transaction. `exchangeId` makes replays idempotent.
 */
export const postInternalCashExchange = async (params: {
	requestContext: RequestContext
	warehouseId: string
	accountType: unknown
	fromCurrencyId: unknown
	toCurrencyId: unknown
	fromAmount: unknown
	toAmount: unknown
	fromExchangeRateToPrimary: unknown
	toExchangeRateToPrimary: unknown
	exchangeId?: unknown
	reason?: string
	settingsRates?: ReadonlyMap<string, number>
}) => {
	const input = validated(
		() => validateCashExchangeInput(params),
		'Invalid exchange.',
	)
	const exchangeId =
		params.exchangeId === undefined || params.exchangeId === ''
			? uuidv4()
			: String(params.exchangeId).trim()

	if (!EXCHANGE_ID_PATTERN.test(exchangeId)) {
		throw fail('Exchange id is invalid.')
	}

	const tenantId = getTenantContext(params.requestContext).tenantId
	const db = getDb()
	// Replays answer from the posted legs (and reject different values).
	const posted = await db
		.select({
			accountType: cashLedgerEntries.accountType,
			currencyId: cashLedgerEntries.currencyId,
			amount: cashLedgerEntries.amount,
		})
		.from(cashLedgerEntries)
		.where(
			and(
				eq(cashLedgerEntries.tenantId, tenantId),
				eq(cashLedgerEntries.referenceType, CASH_REFERENCE_TYPES.EXCHANGE),
				eq(cashLedgerEntries.referenceId, exchangeId),
			),
		)
	const legs = posted.map(leg => ({ ...leg, amount: Number(leg.amount) }))
	const postedFrom = legs.find(leg => leg.amount < 0)
	const postedTo = legs.find(leg => leg.amount > 0)

	if (postedFrom && postedTo) {
		if (
			postedFrom.currencyId !== input.fromCurrencyId ||
			postedTo.currencyId !== input.toCurrencyId ||
			roundPrimary(-postedFrom.amount) !== input.fromAmount ||
			roundPrimary(postedTo.amount) !== input.toAmount
		) {
			throw fail('This exchange was already recorded with different values.')
		}

		return {
			...input,
			accountType: postedFrom.accountType as CashAccountType,
			fromCurrencyId: postedFrom.currencyId,
			toCurrencyId: postedTo.currencyId,
			fromAmount: -postedFrom.amount,
			toAmount: postedTo.amount,
			exchangeId,
		}
	}

	const actor = buildActor(params.requestContext)
	const fromCurrencyId = currencyKey(input.fromCurrencyId)
	const toCurrencyId = currencyKey(input.toCurrencyId)
	const shared = {
		tenantId,
		warehouseId: params.warehouseId,
		referenceType: CASH_REFERENCE_TYPES.EXCHANGE,
		referenceId: exchangeId,
		actor,
		reason: params.reason,
		transferGroupId: exchangeId,
		fromExchangeRateToPrimary: input.fromExchangeRateToPrimary,
		toExchangeRateToPrimary: input.toExchangeRateToPrimary,
	}

	await db.transaction(async tx => {
		await postSingleEffect(
			{
				...shared,
				post: {
					accountType: input.accountType,
					currencyId: fromCurrencyId,
					amount: -input.fromAmount,
					movementType: CASH_MOVEMENT_TYPES.EXCHANGE,
				},
				idempotencyKey: `${CASH_REFERENCE_TYPES.EXCHANGE}:${exchangeId}:from`,
			},
			tx,
		)

		await postSingleEffect(
			{
				...shared,
				post: {
					accountType: input.accountType,
					currencyId: toCurrencyId,
					amount: input.toAmount,
					movementType: CASH_MOVEMENT_TYPES.EXCHANGE,
				},
				idempotencyKey: `${CASH_REFERENCE_TYPES.EXCHANGE}:${exchangeId}:to`,
			},
			tx,
		)
	})

	return { ...input, fromCurrencyId, toCurrencyId, exchangeId }
}

export const postOpeningBalance = async (params: {
	tenantId: string
	warehouseId: string
	accountType: CashAccountType
	amount: number
	currencyId: string
	reason?: string
	actor?: Actor
	tx?: DbTx
}) => {
	const amount = roundPrimary(params.amount)

	if (amount < 0) {
		throw fail('Opening balance cannot be negative.')
	}

	await syncCashEffectsForReference({
		tenantId: params.tenantId,
		warehouseId: params.warehouseId,
		referenceType: CASH_REFERENCE_TYPES.OPENING,
		referenceId: `${params.warehouseId}:${params.accountType}`,
		desired:
			amount === 0
				? []
				: [
						{
							accountType: params.accountType,
							currencyId: currencyKey(params.currencyId),
							amount,
							movementType: CASH_MOVEMENT_TYPES.OPENING_BALANCE,
						},
					],
		reason: params.reason ?? 'Opening balance',
		tx: params.tx,
		actor: params.actor,
	})
}

/** SQL version of `buildCashLedgerListFilter`; null = nothing in scope. */
export const buildCashLedgerListWhere = (params: {
	tenantId: string
	warehouseIds: string[]
	accountType?: string
	movementType?: string
	dateFrom?: string
	dateTo?: string
}): SQL | null => {
	const warehouseIds = params.warehouseIds.map(id => id.trim()).filter(Boolean)

	if (warehouseIds.length === 0) return null

	const accountType = params.accountType?.trim()
	const movementType = params.movementType?.trim()
	const from = parseLedgerDateBound(params.dateFrom, false)
	const to = parseLedgerDateBound(params.dateTo, true)

	return and(
		eq(cashLedgerEntries.tenantId, requireTenantId(params.tenantId)),
		inArray(cashLedgerEntries.warehouseId, warehouseIds),
		accountType ? eq(cashLedgerEntries.accountType, accountType) : undefined,
		movementType ? eq(cashLedgerEntries.movementType, movementType) : undefined,
		from ? gte(cashLedgerEntries.createdAt, from) : undefined,
		to ? lte(cashLedgerEntries.createdAt, to) : undefined,
	)!
}

const enrichLedgerReferenceLabels = async (
	tenantId: string,
	entries: CashLedgerListEntry[],
): Promise<CashLedgerListEntry[]> => {
	if (entries.length === 0) return entries

	const db = getDb()
	const ids = (type: string) => [
		...new Set(
			entries.filter(e => e.referenceType === type).map(e => e.referenceId),
		),
	]
	const sellingIds = ids(CASH_REFERENCE_TYPES.SELLING_INVOICE)
	const buyingIds = ids(CASH_REFERENCE_TYPES.BUYING_INVOICE)
	const actionIds = ids(CASH_REFERENCE_TYPES.DAILY_ACTION)
	const transferGroupIds = [
		...new Set(
			entries
				.filter(
					e =>
						(e.referenceType === CASH_REFERENCE_TYPES.TRANSFER ||
							e.referenceType === CASH_REFERENCE_TYPES.EXCHANGE) &&
						e.transferGroupId,
				)
				.map(e => e.transferGroupId as string),
		),
	]
	const [sellingRows, buyingRows, actionRows, transferRows] = await Promise.all(
		[
			sellingIds.length
				? db
						.select({
							invoiceId: invoices.invoiceId,
							invoiceNumber: invoices.invoiceNumber,
						})
						.from(invoices)
						.where(
							and(
								eq(invoices.tenantId, tenantId),
								inArray(invoices.invoiceId, sellingIds),
							),
						)
				: [],
			buyingIds.length
				? db
						.select({
							buyingInvoiceId: buyingInvoices.buyingInvoiceId,
							invoiceNumber: buyingInvoices.invoiceNumber,
						})
						.from(buyingInvoices)
						.where(
							and(
								eq(buyingInvoices.tenantId, tenantId),
								inArray(buyingInvoices.buyingInvoiceId, buyingIds),
							),
						)
				: [],
			actionIds.length
				? db
						.select({
							actionId: dailyActions.actionId,
							entryType: dailyActions.entryType,
							customerName: dailyActions.customerName,
							supplierName: dailyActions.supplierName,
							partnerName: dailyActions.partnerName,
							expenseName: dailyActions.expenseName,
						})
						.from(dailyActions)
						.where(
							and(
								eq(dailyActions.tenantId, tenantId),
								inArray(dailyActions.actionId, actionIds),
							),
						)
				: [],
			transferGroupIds.length
				? db
						.select({
							ledgerEntryId: cashLedgerEntries.ledgerEntryId,
							transferGroupId: cashLedgerEntries.transferGroupId,
							accountType: cashLedgerEntries.accountType,
							currencyId: cashLedgerEntries.currencyId,
							amount: cashLedgerEntries.amount,
						})
						.from(cashLedgerEntries)
						.where(
							and(
								eq(cashLedgerEntries.tenantId, tenantId),
								inArray(cashLedgerEntries.transferGroupId, transferGroupIds),
							),
						)
				: [],
		],
	)
	const sellingById = new Map(
		sellingRows.map(row => [row.invoiceId, row.invoiceNumber ?? '']),
	)
	const buyingById = new Map(
		buyingRows.map(row => [row.buyingInvoiceId, row.invoiceNumber ?? '']),
	)
	const actionById = new Map(actionRows.map(row => [row.actionId, row]))
	const transferOtherByGroup = new Map<string, Set<string>>()
	const groupLegs = new Map<string, typeof transferRows>()

	for (const row of transferRows) {
		const groupId = row.transferGroupId

		if (!groupId) continue

		groupLegs.set(groupId, [...(groupLegs.get(groupId) ?? []), row])

		const types = transferOtherByGroup.get(groupId) ?? new Set()

		types.add(row.accountType)
		transferOtherByGroup.set(groupId, types)
	}

	return entries.map(entry => {
		let referenceLabel: string | undefined

		if (entry.referenceType === CASH_REFERENCE_TYPES.SELLING_INVOICE) {
			referenceLabel = sellingById.get(entry.referenceId) || undefined
		} else if (entry.referenceType === CASH_REFERENCE_TYPES.BUYING_INVOICE) {
			referenceLabel = buyingById.get(entry.referenceId) || undefined
		} else if (entry.referenceType === CASH_REFERENCE_TYPES.DAILY_ACTION) {
			const action = actionById.get(entry.referenceId)

			if (action) {
				if (action.entryType === 'RECEIPT_ENTRY') {
					referenceLabel = action.customerName || undefined
				} else if (action.entryType === 'PAYMENT_ENTRY') {
					referenceLabel =
						action.supplierName || action.partnerName || undefined
				} else if (action.entryType === 'EXPENSE_ENTRY') {
					referenceLabel = action.expenseName || undefined
				} else {
					referenceLabel =
						action.customerName ||
						action.supplierName ||
						action.partnerName ||
						action.expenseName ||
						undefined
				}
			}
		} else if (
			entry.referenceType === CASH_REFERENCE_TYPES.TRANSFER &&
			entry.transferGroupId
		) {
			for (const type of transferOtherByGroup.get(entry.transferGroupId) ??
				[]) {
				if (type !== entry.accountType) {
					referenceLabel = type
					break
				}
			}
		}

		if (
			entry.referenceType === CASH_REFERENCE_TYPES.EXCHANGE &&
			entry.transferGroupId
		) {
			const other = groupLegs
				.get(entry.transferGroupId)
				?.find(leg => leg.ledgerEntryId !== entry.ledgerEntryId)

			if (other) {
				return {
					...entry,
					exchangeCounterLeg: {
						currencyId: other.currencyId,
						amount: Number(other.amount),
					},
				}
			}
		}

		return referenceLabel ? { ...entry, referenceLabel } : entry
	})
}

export const listCashLedgerEntries = async (params: {
	tenantId: string
	warehouseIds: string[]
	accountType?: string
	movementType?: string
	dateFrom?: string
	dateTo?: string
	page?: number | string
	limit?: number | string
}): Promise<{
	entries: CashLedgerListEntry[]
	totalCount: number
	page: number
	limit: number
	totalsByCurrency: Record<string, number>
}> => {
	const page = clampLedgerPage(params.page)
	const limit = clampLedgerLimit(params.limit)
	const where = buildCashLedgerListWhere(params)

	if (!where) {
		return { entries: [], totalCount: 0, page, limit, totalsByCurrency: {} }
	}

	const db = getDb()
	const [[{ count }], rows, sumRows] = await Promise.all([
		db
			.select({ count: sql<number>`count(*)::int` })
			.from(cashLedgerEntries)
			.where(where),
		db
			.select()
			.from(cashLedgerEntries)
			.where(where)
			// id breaks createdAt ties so pages never overlap
			.orderBy(desc(cashLedgerEntries.createdAt), desc(cashLedgerEntries.id))
			.limit(limit)
			.offset((page - 1) * limit),
		db
			.select({
				currencyId: cashLedgerEntries.currencyId,
				amount: sql<string>`sum(${cashLedgerEntries.amount})`,
			})
			.from(cashLedgerEntries)
			.where(where)
			.groupBy(cashLedgerEntries.currencyId),
	])
	const entries: CashLedgerListEntry[] = rows.map(row => ({
		ledgerEntryId: row.ledgerEntryId,
		warehouseId: row.warehouseId,
		cashAccountId: row.cashAccountId,
		accountType: row.accountType,
		currencyId: row.currencyId,
		amount: Number(row.amount),
		movementType: row.movementType,
		referenceType: row.referenceType,
		referenceId: row.referenceId,
		transferGroupId: row.transferGroupId ?? undefined,
		reason: row.reason ?? undefined,
		fromExchangeRateToPrimary: num(row.fromExchangeRateToPrimary),
		toExchangeRateToPrimary: num(row.toExchangeRateToPrimary),
		createdAt: row.createdAt,
		createdBy: createdByOf(row),
	}))
	const totalsByCurrency: Record<string, number> = {}

	for (const row of sumRows) {
		if (row.currencyId) totalsByCurrency[row.currencyId] = Number(row.amount)
	}

	return {
		entries: await enrichLedgerReferenceLabels(params.tenantId, entries),
		totalCount: count,
		page,
		limit,
		totalsByCurrency,
	}
}

export const getCashBalancesForWarehouses = async (
	tenantId: string,
	warehouseIds: string[],
): Promise<{
	accounts: CashBalanceByType[]
	totals: Record<string, number>
}> => {
	const scopedIds = warehouseIds.map(id => id.trim()).filter(Boolean)

	if (scopedIds.length === 0) {
		return { accounts: [], totals: {} }
	}

	for (const warehouseId of scopedIds) {
		await ensureCashAccountsForWarehouse(tenantId, warehouseId)
	}

	const db = getDb()
	const accounts = await db
		.select()
		.from(cashAccounts)
		.where(
			and(
				eq(cashAccounts.tenantId, requireTenantId(tenantId)),
				inArray(cashAccounts.warehouseId, scopedIds),
				eq(cashAccounts.isActive, true),
			),
		)
	const balances = await balancesOf(
		db,
		tenantId,
		accounts.map(account => account.cashAccountId),
	)
	const byType = new Map<string, CashBalanceByType>()

	for (const type of INITIAL_CASH_ACCOUNT_TYPES) {
		byType.set(type, {
			type,
			name: CASH_ACCOUNT_DEFAULT_NAMES[type],
			balances: {},
		})
	}

	for (const account of accounts) {
		const current = byType.get(account.type) ?? {
			type: account.type,
			name: account.name,
			balances: {},
		}

		current.balances = addCashBalances(
			current.balances,
			balances.get(account.cashAccountId) ?? {},
		)

		current.name = account.name
		byType.set(account.type, current)
	}

	const result = [...byType.values()]
	const totals = result.reduce(
		(sum, account) => addCashBalances(sum, account.balances),
		{} as Record<string, number>,
	)

	return { accounts: result, totals }
}
