import mongoose, { ClientSession } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

import { CashAccount } from '../../models/CashAccount'
import { CashLedgerEntry } from '../../models/CashLedgerEntry'
import { Invoice } from '../../models/Invoice'
import { BuyingInvoice } from '../../models/BuyingInvoices'
import { DailyAction } from '../../models/DailyAction'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import {
	addCashBalances,
	currencyBalanceOf,
	normalizeCashBalances,
} from '../store-domain/cashTender'
import { reversedCashPost } from './cashImpact'
import { withTenantScope } from '../mongodb/tenantScopedModel'
import type { RequestContext } from '../types'
import { getTenantContext } from '../tenant'
import {
	CASH_ACCOUNT_DEFAULT_NAMES,
	CASH_MOVEMENT_TYPES,
	CASH_REFERENCE_TYPES,
	INITIAL_CASH_ACCOUNT_TYPES,
	validateCashTransferInput,
	type CashAccountType,
	type DesiredCashPost,
} from './types'

type Actor = {
	_id: string
	displayName: string
	role?: string
	createdAt: Date
}

type CashAccountRow = {
	cashAccountId: string
	warehouseId: string
	type: string
	name: string
	balances?: unknown
	allowNegativeBalance?: boolean
	isActive?: boolean
}

type CashLedgerRow = {
	ledgerEntryId: string
	warehouseId: string
	cashAccountId: string
	accountType: string
	currencyId?: string
	amount: number
	movementType: string
	reversesLedgerEntryId?: string
}

const roundPrimary = (amount: number) => Math.round(amount * 1e8) / 1e8

const buildActor = (requestContext: RequestContext): Actor => ({
	_id: requestContext.userId ?? '',
	displayName:
		`${requestContext.user?.firstName ?? ''} ${requestContext.user?.lastName ?? ''}`.trim() ||
		'System',
	role: requestContext.user?.role ?? requestContext.role,
	createdAt: new Date(),
})

const systemActor = (): Actor => ({
	_id: 'system',
	displayName: 'System',
	role: 'system',
	createdAt: new Date(),
})

export const ensureCashAccountsForWarehouse = async (
	tenantId: string,
	warehouseId: string,
	actor: Actor = systemActor(),
	session?: ClientSession,
) => {
	const accounts: CashAccountRow[] = []

	for (const type of INITIAL_CASH_ACCOUNT_TYPES) {
		const findQuery = withTenantScope(
			CashAccount.findOne({ warehouseId, type }),
			tenantId,
		)
		const existing = (await (session
			? findQuery.session(session).lean()
			: findQuery.lean())) as CashAccountRow | null

		if (existing) {
			accounts.push(existing)

			continue
		}

		const cashAccountId = uuidv4()
		const [created] = await CashAccount.create(
			[
				{
					tenantId,
					cashAccountId,
					warehouseId,
					type,
					name: CASH_ACCOUNT_DEFAULT_NAMES[type],
					isActive: true,
					allowNegativeBalance: false,
					balances: {},
					createdBy: actor,
				},
			],
			session ? { session } : undefined,
		)

		accounts.push(created.toObject() as CashAccountRow)
	}

	return accounts
}

const getAccountOrThrow = async (
	tenantId: string,
	warehouseId: string,
	accountType: string,
	session?: ClientSession,
) => {
	await ensureCashAccountsForWarehouse(
		tenantId,
		warehouseId,
		systemActor(),
		session,
	)

	const accountQuery = withTenantScope(
		CashAccount.findOne({ warehouseId, type: accountType, isActive: true }),
		tenantId,
	)
	const account = (await (session
		? accountQuery.session(session).lean()
		: accountQuery.lean())) as CashAccountRow | null

	if (!account) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			`Cash account ${accountType} not found for warehouse ${warehouseId}.`,
		)
	}

	return account
}

const currencyKey = (currencyId: string) => {
	const id = currencyId.trim()

	if (!id || id.includes('.') || id.includes('$')) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			'Cash currency is invalid.',
		)
	}

	return id
}

/**
 * Apply a signed amount to one currency on an account. A missing balance is
 * zero. A debit cannot spend a different currency.
 */
const applyBalanceDelta = async (
	tenantId: string,
	cashAccountId: string,
	currencyId: string,
	delta: number,
	session: ClientSession | undefined,
) => {
	const rounded = roundPrimary(delta)

	if (rounded === 0) return

	const key = currencyKey(currencyId)
	const balancePath = `balances.${key}`
	const filter: Record<string, unknown> = { cashAccountId }

	if (rounded < 0) {
		filter.$or = [
			{ allowNegativeBalance: true },
			{ [balancePath]: { $gte: roundPrimary(-rounded) } },
		]
	}

	const updateQuery = withTenantScope(
		CashAccount.findOneAndUpdate(
			filter,
			{ $inc: { [balancePath]: rounded } },
			{ new: true },
		),
		tenantId,
	)
	const updated = await (session ? updateQuery.session(session) : updateQuery)

	if (!updated) {
		const accountQuery = withTenantScope(
			CashAccount.findOne({ cashAccountId }),
			tenantId,
		)
		const account = (await (session
			? accountQuery.session(session).lean()
			: accountQuery.lean())) as CashAccountRow | null

		const available = currencyBalanceOf(
			normalizeCashBalances(account?.balances),
			key,
		)
		const name = account?.name ?? cashAccountId

		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			`Amount exceeds available balance in ${name} (${available.toFixed(2)} ${key}).`,
		)
	}
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
	},
	session?: ClientSession,
) => {
	try {
		await CashLedgerEntry.create(
			[
				{
					tenantId: params.tenantId,
					ledgerEntryId: uuidv4(),
					warehouseId: params.warehouseId,
					cashAccountId: params.cashAccountId,
					accountType: params.accountType,
					currencyId: currencyKey(params.currencyId),
					amount: roundPrimary(params.amount),
					movementType: params.movementType,
					referenceType: params.referenceType,
					referenceId: params.referenceId,
					idempotencyKey: params.idempotencyKey,
					transferGroupId: params.transferGroupId,
					reversesLedgerEntryId: params.reversesLedgerEntryId,
					reason: params.reason,
					createdBy: params.actor,
				},
			],
			session ? { session } : undefined,
		)
	} catch (error: unknown) {
		const code =
			error && typeof error === 'object' && 'code' in error
				? (error as { code?: number }).code
				: undefined

		// Duplicate idempotencyKey — treat as successful retry.
		if (code === 11000) {
			return { duplicate: true as const }
		}

		throw error
	}

	return { duplicate: false as const }
}

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
	},
	session?: ClientSession,
) => {
	const account = await getAccountOrThrow(
		params.tenantId,
		params.warehouseId,
		params.post.accountType,
		session,
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
		},
		session,
	)

	if (inserted.duplicate) return

	await applyBalanceDelta(
		params.tenantId,
		account.cashAccountId,
		params.post.currencyId,
		params.post.amount,
		session,
	)
}

const listActiveEffectsForReference = async (
	tenantId: string,
	referenceType: string,
	referenceId: string,
	session?: ClientSession,
) => {
	const entriesQuery = withTenantScope(
		CashLedgerEntry.find({ referenceType, referenceId }).sort({
			createdAt: 1,
		}),
		tenantId,
	)
	const entries = (await (session
		? entriesQuery.session(session).lean()
		: entriesQuery.lean())) as unknown as CashLedgerRow[]

	const reversedIds = new Set(
		entries
			.map(entry => entry.reversesLedgerEntryId)
			.filter((id): id is string => Boolean(id)),
	)

	return entries.filter(
		entry =>
			entry.movementType !== CASH_MOVEMENT_TYPES.REVERSAL &&
			!reversedIds.has(entry.ledgerEntryId),
	)
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
export const syncCashEffectsForReference = async (params: {
	requestContext?: RequestContext
	tenantId: string
	warehouseId: string
	referenceType: string
	referenceId: string
	desired: DesiredCashPost[]
	reason?: string
	session?: ClientSession
	actor?: Actor
}) => {
	const actor =
		params.actor ??
		(params.requestContext ? buildActor(params.requestContext) : systemActor())
	const { tenantId, warehouseId, referenceType, referenceId, session } = params

	await ensureCashAccountsForWarehouse(tenantId, warehouseId, actor, session)

	const active = await listActiveEffectsForReference(
		tenantId,
		referenceType,
		referenceId,
		session,
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
		const reverseKey = `rev:${entry.ledgerEntryId}`
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
				idempotencyKey: reverseKey,
				actor,
				reversesLedgerEntryId: entry.ledgerEntryId,
				reason: params.reason ?? 'تم تعديل او حذف الفاتورة',
			},
			session,
		)

		if (!inserted.duplicate) {
			await applyBalanceDelta(
				tenantId,
				entry.cashAccountId,
				reversed.currencyId,
				reversed.amount,
				session,
			)
		}
	}

	for (const [index, post] of params.desired.entries()) {
		const amountKey = roundPrimary(post.amount)
		const idempotencyKey = `${referenceType}:${referenceId}:${post.accountType}:${post.currencyId}:${post.movementType}:${amountKey}:n${index}`

		await postSingleEffect(
			{
				tenantId,
				warehouseId,
				post,
				referenceType,
				referenceId,
				idempotencyKey,
				actor,
				reason: params.reason,
			},
			session,
		)
	}
}

/** Internal transfer helper — both legs atomic when session is provided. */
export const postInternalCashTransfer = async (params: {
	requestContext: RequestContext
	warehouseId: string
	fromAccountType: CashAccountType
	toAccountType: CashAccountType
	amount: number
	currencyId: string
	reason?: string
	session?: ClientSession
}) => {
	const { fromAccountType, toAccountType, amount } = (() => {
		try {
			return validateCashTransferInput({
				fromAccountType: params.fromAccountType,
				toAccountType: params.toAccountType,
				amount: params.amount,
			})
		} catch (error) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				error instanceof Error ? error.message : 'Invalid transfer.',
			)
		}
	})()

	const tenantId = getTenantContext(params.requestContext).tenantId
	const actor = buildActor(params.requestContext)
	const currencyId = currencyKey(params.currencyId)
	const transferId = uuidv4()
	const run = async (session: ClientSession) => {
		await ensureCashAccountsForWarehouse(
			tenantId,
			params.warehouseId,
			actor,
			session,
		)

		await postSingleEffect(
			{
				tenantId,
				warehouseId: params.warehouseId,
				post: {
					accountType: fromAccountType,
					currencyId,
					amount: -amount,
					movementType: CASH_MOVEMENT_TYPES.TRANSFER,
				},
				referenceType: CASH_REFERENCE_TYPES.TRANSFER,
				referenceId: transferId,
				idempotencyKey: `${CASH_REFERENCE_TYPES.TRANSFER}:${transferId}:from`,
				actor,
				reason: params.reason,
				transferGroupId: transferId,
			},
			session,
		)

		await postSingleEffect(
			{
				tenantId,
				warehouseId: params.warehouseId,
				post: {
					accountType: toAccountType,
					currencyId,
					amount,
					movementType: CASH_MOVEMENT_TYPES.TRANSFER,
				},
				referenceType: CASH_REFERENCE_TYPES.TRANSFER,
				referenceId: transferId,
				idempotencyKey: `${CASH_REFERENCE_TYPES.TRANSFER}:${transferId}:to`,
				actor,
				reason: params.reason,
				transferGroupId: transferId,
			},
			session,
		)

		return { transferId }
	}

	if (params.session) {
		return run(params.session)
	}

	const session = await mongoose.startSession()

	try {
		let result: { transferId: string } | undefined

		await session.withTransaction(async () => {
			result = await run(session)
		})

		return result as { transferId: string }
	} finally {
		await session.endSession()
	}
}

export const postOpeningBalance = async (params: {
	tenantId: string
	warehouseId: string
	accountType: CashAccountType
	amount: number
	currencyId: string
	reason?: string
	actor?: Actor
	session?: ClientSession
}) => {
	const amount = roundPrimary(params.amount)

	if (amount < 0) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			'Opening balance cannot be negative.',
		)
	}

	const referenceId = `${params.warehouseId}:${params.accountType}`

	await syncCashEffectsForReference({
		tenantId: params.tenantId,
		warehouseId: params.warehouseId,
		referenceType: CASH_REFERENCE_TYPES.OPENING,
		referenceId,
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
		session: params.session,
		actor: params.actor,
	})
}

export type CashBalanceByType = {
	type: string
	name: string
	balances: Record<string, number>
}

/** Inclusive day bounds when value is YYYY-MM-DD; otherwise parse as Date. */
export const parseLedgerDateBound = (
	value: string | undefined,
	endOfDay: boolean,
): Date | undefined => {
	const trimmed = value?.trim()

	if (!trimmed) return undefined

	const date = new Date(trimmed)

	if (!Number.isFinite(date.getTime())) return undefined

	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		if (endOfDay) date.setHours(23, 59, 59, 999)
		else date.setHours(0, 0, 0, 0)
	}

	return date
}

export const buildCashLedgerListFilter = (params: {
	warehouseIds: string[]
	accountType?: string
	movementType?: string
	dateFrom?: string
	dateTo?: string
}): Record<string, unknown> | null => {
	const warehouseIds = params.warehouseIds.map(id => id.trim()).filter(Boolean)

	if (warehouseIds.length === 0) return null

	const filter: Record<string, unknown> = {
		warehouseId: { $in: warehouseIds },
	}

	const accountType = params.accountType?.trim()

	if (accountType) filter.accountType = accountType

	const movementType = params.movementType?.trim()

	if (movementType) filter.movementType = movementType

	const from = parseLedgerDateBound(params.dateFrom, false)
	const to = parseLedgerDateBound(params.dateTo, true)

	if (from || to) {
		filter.createdAt = {
			...(from ? { $gte: from } : {}),
			...(to ? { $lte: to } : {}),
		}
	}

	return filter
}

export const clampLedgerPage = (page?: number | string) => {
	const n = Math.floor(Number(page))

	if (!Number.isFinite(n) || n < 1) return 1

	return n
}

export const clampLedgerLimit = (limit?: number | string) => {
	if (limit === undefined || limit === '') return 50

	const n = Math.floor(Number(limit))

	if (!Number.isFinite(n)) return 50

	return Math.min(100, Math.max(1, n))
}

export type CashLedgerListEntry = {
	ledgerEntryId: string
	warehouseId: string
	cashAccountId: string
	accountType: string
	currencyId: string
	amount: number
	movementType: string
	referenceType: string
	referenceId: string
	/** Human label for the second reference line (invoice #, party name, other account). */
	referenceLabel?: string
	transferGroupId?: string
	reason?: string
	createdAt: Date
	createdBy: {
		_id: string
		displayName: string
		role?: string
	}
}

const enrichLedgerReferenceLabels = async (
	tenantId: string,
	entries: CashLedgerListEntry[],
): Promise<CashLedgerListEntry[]> => {
	if (entries.length === 0) return entries

	const sellingIds = new Set<string>()
	const buyingIds = new Set<string>()
	const actionIds = new Set<string>()
	const transferGroupIds = new Set<string>()

	for (const entry of entries) {
		if (entry.referenceType === CASH_REFERENCE_TYPES.SELLING_INVOICE) {
			sellingIds.add(entry.referenceId)
		} else if (entry.referenceType === CASH_REFERENCE_TYPES.BUYING_INVOICE) {
			buyingIds.add(entry.referenceId)
		} else if (entry.referenceType === CASH_REFERENCE_TYPES.DAILY_ACTION) {
			actionIds.add(entry.referenceId)
		} else if (
			entry.referenceType === CASH_REFERENCE_TYPES.TRANSFER &&
			entry.transferGroupId
		) {
			transferGroupIds.add(entry.transferGroupId)
		}
	}

	const [sellingRows, buyingRows, actionRows, transferRows] = await Promise.all(
		[
			sellingIds.size
				? withTenantScope(
						Invoice.find({ invoiceId: { $in: [...sellingIds] } }).select(
							'invoiceId invoiceNumber',
						),
						tenantId,
					).lean<Array<{ invoiceId: string; invoiceNumber?: string }>>()
				: Promise.resolve([]),
			buyingIds.size
				? withTenantScope(
						BuyingInvoice.find({
							buyingInvoiceId: { $in: [...buyingIds] },
						}).select('buyingInvoiceId invoiceNumber'),
						tenantId,
					).lean<Array<{ buyingInvoiceId: string; invoiceNumber?: string }>>()
				: Promise.resolve([]),
			actionIds.size
				? withTenantScope(
						DailyAction.find({ actionId: { $in: [...actionIds] } }).select(
							'actionId entryType customerName supplierName partnerName expenseName',
						),
						tenantId,
					).lean<
						Array<{
							actionId: string
							entryType?: string
							customerName?: string
							supplierName?: string
							partnerName?: string
							expenseName?: string
						}>
					>()
				: Promise.resolve([]),
			transferGroupIds.size
				? withTenantScope(
						CashLedgerEntry.find({
							transferGroupId: { $in: [...transferGroupIds] },
						}).select('transferGroupId accountType amount'),
						tenantId,
					).lean<
						Array<{
							transferGroupId?: string
							accountType: string
							amount: number
						}>
					>()
				: Promise.resolve([]),
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

	for (const row of transferRows) {
		const groupId = row.transferGroupId

		if (!groupId) continue

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
			const types = transferOtherByGroup.get(entry.transferGroupId)

			if (types) {
				for (const type of types) {
					if (type !== entry.accountType) {
						referenceLabel = type
						break
					}
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
	const filter = buildCashLedgerListFilter(params)

	if (!filter) {
		return { entries: [], totalCount: 0, page, limit, totalsByCurrency: {} }
	}

	const skip = (page - 1) * limit
	const tenantFilter = { tenantId: params.tenantId, ...filter }
	const [totalCount, rows, sumRows] = await Promise.all([
		CashLedgerEntry.countDocuments(tenantFilter),
		withTenantScope(CashLedgerEntry.find(filter), params.tenantId)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.select(
				'ledgerEntryId warehouseId cashAccountId accountType currencyId amount movementType referenceType referenceId transferGroupId reason createdAt createdBy',
			)
			.lean(),
		CashLedgerEntry.aggregate<{ _id?: string; amount: number }>([
			{ $match: tenantFilter },
			{ $group: { _id: '$currencyId', amount: { $sum: '$amount' } } },
		]),
	])

	const entries = (rows as unknown as CashLedgerListEntry[]).map(row => ({
		ledgerEntryId: row.ledgerEntryId,
		warehouseId: row.warehouseId,
		cashAccountId: row.cashAccountId,
		accountType: row.accountType,
		currencyId: row.currencyId,
		amount: row.amount,
		movementType: row.movementType,
		referenceType: row.referenceType,
		referenceId: row.referenceId,
		transferGroupId: row.transferGroupId,
		reason: row.reason,
		createdAt: row.createdAt,
		createdBy: {
			_id: row.createdBy?._id ?? '',
			displayName: row.createdBy?.displayName ?? '',
			role: row.createdBy?.role,
		},
	}))

	const enriched = await enrichLedgerReferenceLabels(params.tenantId, entries)
	const totalsByCurrency: Record<string, number> = {}

	for (const row of sumRows) {
		if (!row._id) continue

		totalsByCurrency[row._id] = row.amount
	}

	return { entries: enriched, totalCount, page, limit, totalsByCurrency }
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

	const accounts = (await withTenantScope(
		CashAccount.find({
			warehouseId: { $in: scopedIds },
			isActive: true,
		}),
		tenantId,
	).lean()) as unknown as CashAccountRow[]

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
			normalizeCashBalances(account.balances),
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

export { buildActor }
