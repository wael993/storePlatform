/**
 * Self-check for warehouse transfer grouping (no test framework).
 * Run: npx ts-node src/shared/warehouseTransfer.selfcheck.ts
 */
import assert from 'assert'
import { groupWarehouseTransferMovings } from './warehouseTransfer'

const single = groupWarehouseTransferMovings([
	{
		referenceId: 't1',
		referenceType: 'warehouse_transfer',
		type: 'transfer_out',
		productId: 'p1',
		warehouseId: 'wA',
		quantity: 10,
		createdAt: '2026-09-06T10:00:00.000Z',
		createdBy: { displayName: 'Ada', createdAt: '2026-09-06T10:00:00.000Z' },
	},
	{
		referenceId: 't1',
		referenceType: 'warehouse_transfer',
		type: 'transfer_in',
		productId: 'p1',
		warehouseId: 'wB',
		quantity: 10,
		createdAt: '2026-09-06T10:00:00.000Z',
	},
	{
		referenceId: 'orphan',
		referenceType: 'warehouse_transfer',
		type: 'transfer_out',
		productId: 'p2',
		warehouseId: 'wA',
		quantity: 1,
	},
])

assert.equal(single.length, 1)
assert.deepEqual(single[0].items, [{ productId: 'p1', quantity: 10 }])
assert.equal(single[0].fromWarehouseId, 'wA')
assert.equal(single[0].toWarehouseId, 'wB')

const multi = groupWarehouseTransferMovings([
	{
		referenceId: 't2',
		referenceType: 'warehouse_transfer',
		type: 'transfer_out',
		productId: 'p1',
		warehouseId: 'wA',
		quantity: 3,
		createdAt: '2026-09-06T11:00:00.000Z',
	},
	{
		referenceId: 't2',
		referenceType: 'warehouse_transfer',
		type: 'transfer_in',
		productId: 'p1',
		warehouseId: 'wB',
		quantity: 3,
	},
	{
		referenceId: 't2',
		referenceType: 'warehouse_transfer',
		type: 'transfer_out',
		productId: 'p2',
		warehouseId: 'wA',
		quantity: 5,
		createdAt: '2026-09-06T11:00:00.000Z',
	},
	{
		referenceId: 't2',
		referenceType: 'warehouse_transfer',
		type: 'transfer_in',
		productId: 'p2',
		warehouseId: 'wB',
		quantity: 5,
	},
])

assert.equal(multi.length, 1)
assert.equal(multi[0].referenceId, 't2')
assert.deepEqual(
	multi[0].items.sort((a, b) => a.productId.localeCompare(b.productId)),
	[
		{ productId: 'p1', quantity: 3 },
		{ productId: 'p2', quantity: 5 },
	],
)

const mismatched = groupWarehouseTransferMovings([
	{
		referenceId: 't3',
		referenceType: 'warehouse_transfer',
		type: 'transfer_out',
		productId: 'p1',
		warehouseId: 'wA',
		quantity: 4,
		createdAt: '2026-09-06T12:00:00.000Z',
	},
	{
		referenceId: 't3',
		referenceType: 'warehouse_transfer',
		type: 'transfer_in',
		productId: 'p1',
		warehouseId: 'wB',
		quantity: 2,
	},
])

assert.equal(mismatched.length, 0)

const mixedDest = groupWarehouseTransferMovings([
	{
		referenceId: 't4',
		referenceType: 'warehouse_transfer',
		type: 'transfer_out',
		productId: 'p1',
		warehouseId: 'wA',
		quantity: 1,
		createdAt: '2026-09-06T13:00:00.000Z',
	},
	{
		referenceId: 't4',
		referenceType: 'warehouse_transfer',
		type: 'transfer_in',
		productId: 'p1',
		warehouseId: 'wB',
		quantity: 1,
	},
	{
		referenceId: 't4',
		referenceType: 'warehouse_transfer',
		type: 'transfer_out',
		productId: 'p2',
		warehouseId: 'wA',
		quantity: 1,
	},
	{
		referenceId: 't4',
		referenceType: 'warehouse_transfer',
		type: 'transfer_in',
		productId: 'p2',
		warehouseId: 'wC',
		quantity: 1,
	},
])

assert.equal(mixedDest.length, 0)

const duplicateOut = groupWarehouseTransferMovings([
	{
		referenceId: 't5',
		referenceType: 'warehouse_transfer',
		type: 'transfer_out',
		productId: 'p1',
		warehouseId: 'wA',
		quantity: 2,
		createdAt: '2026-09-06T14:00:00.000Z',
	},
	{
		referenceId: 't5',
		referenceType: 'warehouse_transfer',
		type: 'transfer_out',
		productId: 'p1',
		warehouseId: 'wA',
		quantity: 5,
	},
	{
		referenceId: 't5',
		referenceType: 'warehouse_transfer',
		type: 'transfer_in',
		productId: 'p1',
		warehouseId: 'wB',
		quantity: 5,
	},
])

assert.equal(duplicateOut.length, 0)

console.log('warehouseTransfer.selfcheck: ok')
