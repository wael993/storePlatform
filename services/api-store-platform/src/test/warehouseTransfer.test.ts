import { describe, expect, it } from 'vitest'

import { groupWarehouseTransferMovings } from '../shared/warehouseTransfer'

describe('groupWarehouseTransferMovings', () => {
	it('groups paired legs into one transfer', () => {
		const single = groupWarehouseTransferMovings([
			{
				referenceId: 't1',
				referenceType: 'warehouse_transfer',
				type: 'transfer_out',
				productId: 'p1',
				warehouseId: 'wA',
				quantity: 10,
				createdAt: '2026-09-06T10:00:00.000Z',
				createdBy: {
					displayName: 'Ada',
					createdAt: '2026-09-06T10:00:00.000Z',
				},
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

		expect(single).toHaveLength(1)
		expect(single[0].items).toEqual([{ productId: 'p1', quantity: 10 }])
		expect(single[0].fromWarehouseId).toBe('wA')
		expect(single[0].toWarehouseId).toBe('wB')

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

		expect(multi).toHaveLength(1)
		expect(multi[0].referenceId).toBe('t2')
		expect(
			multi[0].items.sort((a, b) => a.productId.localeCompare(b.productId)),
		).toEqual([
			{ productId: 'p1', quantity: 3 },
			{ productId: 'p2', quantity: 5 },
		])
	})

	it('drops mismatched, mixed-destination, and duplicate legs', () => {
		expect(
			groupWarehouseTransferMovings([
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
			]),
		).toEqual([])

		expect(
			groupWarehouseTransferMovings([
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
			]),
		).toEqual([])

		expect(
			groupWarehouseTransferMovings([
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
			]),
		).toEqual([])
	})
})
