import { and, eq, inArray, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

import { AuditActor, createdByColumns, DbTx, requireTenantId } from '..'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../../shared/errorCodes'
import { toDocs } from '../docs'
import { Doc } from '../etl/mongoToPg'
import { inventories as inv, stockMovings } from '../schema'

/**
 * Postgres versions of the atomic stock writes in `api.controller.ts`
 * (`atomicAdjustInventoryQuantity`, `atomicPurchaseInventoryAdjustment`,
 * `claimWarehouseTransferLegs`). Same formulas as the Mongo pipelines; every
 * expression reads the row as it was before the statement, like `$set` did.
 * Callers keep doing the permission checks.
 */

const n = (value: number) => sql`${String(value)}::numeric`
const qty = sql`coalesce(${inv.quantity}, 0)`
const reserved = sql`coalesce(${inv.reservedQuantity}, 0)`

/** `purchaseAverageCostExpression` (shared/movingAverageCost.ts) in SQL. */
const averageCostAfterPurchase = (quantity: number, unitPrice: number) => {
	const priorQty = sql`greatest(0, ${qty})`

	return sql`case when ${priorQty} + ${n(quantity)} <= 0 then ${n(unitPrice)}
		else (${priorQty} * coalesce(${inv.averageCost}, ${n(unitPrice)}) + ${n(quantity * unitPrice)})
			/ (${priorQty} + ${n(quantity)}) end`
}

const stockAfter = (delta: number) => ({
	quantity: sql`${qty} + ${n(delta)}`,
	// same rule as availableQuantityFromStock(quantity, reserved)
	availableQuantity: sql`greatest(0, ${qty} + ${n(delta)} - ${reserved})`,
	updatedAt: sql`now()`,
})

const insufficient = (productId: string) =>
	new BusinessLogicError(
		ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
		`Insufficient stock for product ${productId}.`,
	)

const newRow = (
	tenantId: string,
	productId: string,
	warehouseId: string,
	delta: number,
	actor: AuditActor,
	averageCost?: number,
) => {
	const inventoryId = uuidv4()

	return {
		id: inventoryId,
		tenantId,
		inventoryId,
		productId,
		warehouseId,
		quantity: String(delta),
		availableQuantity: String(Math.max(0, delta)),
		...(averageCost !== undefined ? { averageCost: String(averageCost) } : {}),
		...createdByColumns(actor),
	}
}

const asDoc = (rows: Array<Record<string, unknown>>) => toDocs(inv, rows)[0]

/**
 * Adds `quantityDelta` (upserts on first write). A decrease without
 * `allowNegative` only succeeds while quantity − reserved covers it: the
 * atomic stock gate against concurrent oversell / over-transfer.
 */
export const adjustInventoryQuantity = async (
	tx: DbTx,
	params: {
		tenantId: string
		productId: string
		warehouseId: string
		quantityDelta: number
		allowNegative?: boolean
		/** Transfer-in: qty-weighted averageCost (same formula as purchase). */
		seedAverageCost?: number
		actor: AuditActor
	},
): Promise<Doc> => {
	const tenantId = requireTenantId(params.tenantId)
	const { productId, warehouseId, quantityDelta } = params
	const seeded =
		params.seedAverageCost !== undefined && quantityDelta > 0
			? params.seedAverageCost
			: undefined
	const set = {
		...stockAfter(quantityDelta),
		...(seeded !== undefined
			? { averageCost: averageCostAfterPurchase(quantityDelta, seeded) }
			: {}),
	}
	const key = and(
		eq(inv.tenantId, tenantId),
		eq(inv.productId, productId),
		eq(inv.warehouseId, warehouseId),
	)

	if (quantityDelta < 0 && !params.allowNegative) {
		const rows = await tx
			.update(inv)
			.set(set)
			.where(and(key, sql`${qty} - ${reserved} >= ${n(-quantityDelta)}`))
			.returning()

		if (!rows.length) throw insufficient(productId)

		return asDoc(rows)
	}

	const rows = await tx
		.insert(inv)
		.values(
			newRow(
				tenantId,
				productId,
				warehouseId,
				quantityDelta,
				params.actor,
				seeded,
			),
		)
		.onConflictDoUpdate({
			target: [inv.tenantId, inv.warehouseId, inv.productId],
			set,
		})
		.returning()

	return asDoc(rows)
}

/** Purchase: quantity + moving averageCost in one statement (no race on averageCost). */
export const purchaseInventoryAdjustment = async (
	tx: DbTx,
	params: {
		tenantId: string
		productId: string
		warehouseId: string
		purchaseQuantity: number
		purchaseUnitPrice: number
		actor: AuditActor
	},
): Promise<Doc> => {
	const tenantId = requireTenantId(params.tenantId)
	const { productId, warehouseId, purchaseQuantity, purchaseUnitPrice } = params
	const rows = await tx
		.insert(inv)
		.values(
			// New row: prior qty 0, prior average = unit price, so the formula gives the unit price.
			newRow(
				tenantId,
				productId,
				warehouseId,
				purchaseQuantity,
				params.actor,
				purchaseUnitPrice,
			),
		)
		.onConflictDoUpdate({
			target: [inv.tenantId, inv.warehouseId, inv.productId],
			set: {
				...stockAfter(purchaseQuantity),
				averageCost: averageCostAfterPurchase(
					purchaseQuantity,
					purchaseUnitPrice,
				),
			},
		})
		.returning()

	return asDoc(rows)
}

/**
 * Removes a warehouse transfer's legs inside the caller's transaction and fails
 * unless this call removed exactly the expected legs. Stops a concurrent edit or
 * a double-clicked delete from reversing the same transfer twice.
 */
export const claimWarehouseTransferLegs = async (
	tx: DbTx,
	tenantId: string,
	existing: {
		referenceId: string
		fromWarehouseId: string
		toWarehouseId: string
		items: Array<{ productId: string; quantity: number }>
	},
): Promise<void> => {
	const changedMeanwhile = () =>
		new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			'This warehouse transfer changed meanwhile. Reload and try again.',
		)
	const scope = and(
		eq(stockMovings.tenantId, requireTenantId(tenantId)),
		eq(stockMovings.referenceType, 'warehouse_transfer'),
		eq(stockMovings.referenceId, existing.referenceId),
	)
	// FOR UPDATE: a concurrent claim waits here, then finds the legs gone.
	const legs = await tx.select().from(stockMovings).where(scope).for('update')
	const expected = new Set(
		existing.items.flatMap(item => [
			`${item.productId}|transfer_out|${existing.fromWarehouseId}|${item.quantity}`,
			`${item.productId}|transfer_in|${existing.toWarehouseId}|${item.quantity}`,
		]),
	)

	if (legs.length !== expected.size) throw changedMeanwhile()

	for (const leg of legs) {
		const key = `${leg.productId}|${leg.type}|${leg.warehouseId}|${Number(leg.quantity)}`

		if (!expected.delete(key)) throw changedMeanwhile()
	}

	const deleted = await tx
		.delete(stockMovings)
		.where(
			and(
				scope,
				inArray(
					stockMovings.id,
					legs.map(leg => leg.id),
				),
			),
		)
		.returning({ id: stockMovings.id })

	if (deleted.length !== legs.length) throw changedMeanwhile()
}
