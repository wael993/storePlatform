import { and, asc, eq, isNull, notInArray, or, sql } from 'drizzle-orm'
import { Types } from 'mongoose'

import { Executor, getDb, requireTenantId } from '..'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../../shared/errorCodes'
import { InvoiceStatus } from '../../shared/globalEnums'
import {
	formatInvoiceNumber,
	InvoiceNumberPrefix,
	isPrefixedInvoiceNumber,
	parseInvoiceSequence,
} from '../../shared/invoiceNumbering'
import {
	buyingInvoiceItems,
	buyingInvoices,
	invoiceItems,
	invoices,
	offlineSyncStates as sync,
} from '../schema'

/**
 * Postgres versions of the invoice-number and last-price helpers in
 * `api.controller.ts`. Same rules; the offline block is one atomic upsert
 * instead of read-then-write.
 *
 * Known gap kept as-is (no behavior change in the port): invoice numbers have no
 * unique constraint, so two simultaneous creates can pick the same number, as in Mongo.
 */

type Kind = 'selling' | 'buying'

const tableOf = (kind: Kind) => (kind === 'selling' ? invoices : buyingInvoices)

/** `resolveLatestInvoiceSequence`: highest parsed sequence + 1 (same JS parser). */
export const latestInvoiceSequence = async (
	tenantId: string,
	kind: Kind,
	db: Executor = getDb(),
) => {
	const table = tableOf(kind)
	const rows = await db
		.select({ invoiceNumber: table.invoiceNumber })
		.from(table)
		.where(eq(table.tenantId, requireTenantId(tenantId)))

	return (
		rows.reduce(
			(max, row) => Math.max(max, parseInvoiceSequence(row.invoiceNumber)),
			0,
		) + 1
	)
}

/**
 * `resolveNextInvoiceNumber`: selling never goes below the offline floor.
 * `resolveNextBuyingInvoiceNumber` ignores its floor (as in Mongo; see INV-NUM-1 notes).
 */
export const nextInvoiceSequence = async (
	tenantId: string,
	kind: Kind,
	db: Executor = getDb(),
) => {
	const latest = await latestInvoiceSequence(tenantId, kind, db)

	if (kind === 'buying') return latest

	const [state] = await db
		.select({ floor: sync.minOnlineInvoiceNumber })
		.from(sync)
		.where(eq(sync.tenantId, requireTenantId(tenantId)))

	return Math.max(latest, state?.floor ?? 1)
}

/**
 * `allocateInvoiceNumberForCreate`: a client-prefixed number is used when free
 * (offline reserved blocks); otherwise the first free one from the next sequence.
 */
export const allocateInvoiceNumber = async (
	tenantId: string,
	prefix: InvoiceNumberPrefix,
	requestedNumber: string | undefined,
	db: Executor = getDb(),
): Promise<string> => {
	const kind: Kind = prefix === 'SI' ? 'selling' : 'buying'
	const table = tableOf(kind)
	const taken = async (invoiceNumber: string) =>
		(
			await db
				.select({ id: table.id })
				.from(table)
				.where(
					and(
						eq(table.tenantId, requireTenantId(tenantId)),
						eq(table.invoiceNumber, invoiceNumber),
					),
				)
				.limit(1)
		).length > 0
	const requested = requestedNumber?.trim()

	if (
		requested &&
		isPrefixedInvoiceNumber(requested, prefix) &&
		!(await taken(requested))
	) {
		return requested
	}

	const sequence = await nextInvoiceSequence(tenantId, kind, db)

	for (let offset = 0; offset < 50; offset++) {
		const candidate = formatInvoiceNumber(prefix, sequence + offset)

		if (!(await taken(candidate))) return candidate
	}

	throw new BusinessLogicError(
		ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
		`Unable to allocate a unique ${prefix} invoice number.`,
	)
}

/**
 * `allocateOfflineInvoiceBlock` / buying variant: reserves [start, start + size - 1]
 * and raises the online floor past it, atomically (concurrent devices never overlap).
 */
export const allocateOfflineBlock = async (
	tenantId: string,
	kind: Kind,
	blockSize: number,
	db: Executor = getDb(),
): Promise<{ blockStart: number; blockEnd: number }> => {
	const latest = await latestInvoiceSequence(tenantId, kind, db)
	const next =
		kind === 'selling' ? sync.nextBlockStart : sync.buyingNextBlockStart
	const floor =
		kind === 'selling'
			? sync.minOnlineInvoiceNumber
			: sync.minOnlineBuyingInvoiceNumber
	const nextKey = kind === 'selling' ? 'nextBlockStart' : 'buyingNextBlockStart'
	const floorKey =
		kind === 'selling'
			? 'minOnlineInvoiceNumber'
			: 'minOnlineBuyingInvoiceNumber'
	const after = sql`coalesce(${next}, ${latest}) + ${blockSize}`
	const [row] = await db
		.insert(sync)
		.values({
			id: new Types.ObjectId().toHexString(),
			tenantId: requireTenantId(tenantId),
			[nextKey]: latest + blockSize,
			[floorKey]: latest + blockSize,
		})
		.onConflictDoUpdate({
			target: sync.tenantId,
			// greatest() ignores NULL, like $max on a missing field
			set: { [nextKey]: after, [floorKey]: sql`greatest(${floor}, ${after})` },
		})
		.returning({ nextBlockStart: next })
	const blockStart = Number(row.nextBlockStart) - blockSize

	return { blockStart, blockEnd: blockStart + blockSize - 1 }
}

/**
 * `resolveLastSellingPricesByProductId` / buying variant: newest posted
 * invoice's unit price per product. Like `$nin`, a missing status counts as
 * posted; like Mongo's descending sort, a missing issuedAt sorts last.
 */
export const lastUnitPricesByProduct = async (
	tenantId: string,
	kind: Kind,
	db: Executor = getDb(),
): Promise<Map<string, number>> => {
	const header = tableOf(kind)
	const items = kind === 'selling' ? invoiceItems : buyingInvoiceItems
	const link =
		kind === 'selling'
			? invoiceItems.invoiceRowId
			: buyingInvoiceItems.buyingInvoiceRowId
	const excluded = [
		InvoiceStatus.DRAFT,
		InvoiceStatus.CANCELLED,
		InvoiceStatus.VOID,
	]
	const rows = await db
		.selectDistinctOn([items.productId], {
			productId: items.productId,
			unitPrice: items.unitPrice,
		})
		.from(items)
		.innerJoin(header, eq(header.id, link))
		.where(
			and(
				eq(header.tenantId, requireTenantId(tenantId)),
				or(isNull(header.status), notInArray(header.status, excluded)),
			),
		)
		.orderBy(
			items.productId,
			sql`${header.issuedAt} desc nulls last`,
			asc(items.position),
		)
	const map = new Map<string, number>()

	for (const row of rows) {
		const price = Number(row.unitPrice)

		if (row.productId && Number.isFinite(price)) map.set(row.productId, price)
	}

	return map
}
