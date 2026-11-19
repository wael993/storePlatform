import { Decimal128, ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'

import { MapResult, mapDocs, SPECS } from '../db/etl/mongoToPg'
import * as t from '../db/schema'

const spec = (model: string) => SPECS.find(s => s.model === model)!

const run = (model: string, docs: Record<string, unknown>[]) => {
	const result: MapResult = { rows: new Map(), unmapped: new Map(), errors: [] }

	mapDocs(spec(model), docs, result)

	return result
}

describe('Mongo → Postgres ETL mapping', () => {
	it('keeps money exact and flattens price', () => {
		const _id = new ObjectId()
		const { rows, unmapped } = run('Products', [
			{
				_id,
				tenantId: 'ten-1',
				productId: 'p-1',
				name: 'Tea',
				price: { retailPrice: 0.1 + 0.2, purchasePrice: 2, currency: 'USD' },
				createdBy: { _id: 'u-1', displayName: 'Ana', createdAt: new Date(0) },
			},
		])
		const row = rows.get(t.products)![0]

		expect(row.id).toBe(_id.toHexString())
		expect(row.retailPrice).toBe('0.30000000000000004') // no rounding
		expect(row.purchasePrice).toBe('2')
		expect(row.priceCurrency).toBe('USD')
		expect(row.createdById).toBe('u-1')
		expect(row.createdAt).toEqual(_id.getTimestamp()) // model had no timestamps
		expect(unmapped.size).toBe(0)
	})

	it('explodes invoice arrays into child rows linked to the parent id', () => {
		const _id = new ObjectId()
		const { rows } = run('Invoice', [
			{
				_id,
				tenantId: 'ten-1',
				invoiceId: 'inv-1',
				items: [
					{ productId: 'p-1', name: 'Tea', quantity: 2, unitPrice: 1.5 },
					{ productId: 'p-2', name: 'Cup', quantity: 1, unitPrice: 3 },
				],
				currencyAmounts: [
					{
						currencyId: 'c-1',
						name: 'USD',
						exchangeRate: Decimal128.fromString('1.25'),
						isPrimary: true,
						amount: 6,
						paidAmount: 6,
						remainingAmount: 0,
						subtotal: 6,
						tax: 0,
						discount: 0,
					},
				],
			},
		])
		const items = rows.get(t.invoiceItems)!

		expect(items.map(i => [i.position, i.productId, i.invoiceRowId])).toEqual([
			[0, 'p-1', _id.toHexString()],
			[1, 'p-2', _id.toHexString()],
		])

		expect(items[0].tenantId).toBe('ten-1')
		expect(rows.get(t.invoiceCurrencyAmounts)![0].exchangeRate).toBe('1.25')
		expect(rows.get(t.invoiceTenders) ?? []).toEqual([])
		expect(rows.get(t.invoices)![0]).not.toHaveProperty('items')
	})

	it('turns the cash balances map into one row per currency', () => {
		const { rows } = run('CashAccount', [
			{
				_id: new ObjectId(),
				tenantId: 'ten-1',
				cashAccountId: 'ca-1',
				warehouseId: 'w-1',
				type: 'daily_cash',
				name: 'Daily Cash',
				balances: { usd: 10.5, eur: -2 },
			},
		])

		expect(rows.get(t.cashAccountBalances)).toEqual([
			{
				tenantId: 'ten-1',
				cashAccountId: 'ca-1',
				currencyId: 'usd',
				amount: '10.5',
			},
			{
				tenantId: 'ten-1',
				cashAccountId: 'ca-1',
				currencyId: 'eur',
				amount: '-2',
			},
		])
	})

	it('reports fields that would be dropped instead of losing them', () => {
		const { unmapped } = run('Unit', [
			{
				_id: new ObjectId(),
				tenantId: 'ten-1',
				unitId: 'u',
				name: 'kg',
				legacyCode: 'x',
			},
		])

		expect([...unmapped]).toEqual([['units.legacyCode', 1]])
	})

	it('drops only the listed legacy fields', () => {
		const { rows, unmapped } = run('Products', [
			{
				_id: new ObjectId(),
				tenantId: 'ten-1',
				productId: 'p-1',
				name: 'Tea',
				price: { retailPrice: 1, currency: 'USD' },
				stock: { quantity: 0 },
				unit: 'kg',
				somethingNew: 1,
			},
		])

		expect(rows.get(t.products)![0]).not.toHaveProperty('stock')
		expect([...unmapped]).toEqual([['products.somethingNew', 1]])
	})

	it('collects docs that cannot be loaded instead of stopping', () => {
		const { errors, rows } = run('Unit', [
			{ _id: 'u-1', tenantId: 'ten-1', name: 'kg' }, // no unitId
			{ _id: 'u-2', tenantId: 'ten-1', unitId: 'u-2', name: 'pc' },
		])

		expect(errors).toEqual(['units.unitId (_id u-1): required value missing'])
		expect(rows.get(t.units)).toHaveLength(1)
	})

	it('rejects a non-number in a money column', () => {
		const { errors } = run('Project', [
			{
				_id: 'pr',
				tenantId: 'ten-1',
				projectId: 'pr',
				name: 'X',
				contractCost: {},
			},
		])

		expect(errors[0]).toMatch(/^projects.contractCost \(_id pr\): not a number/)
	})
})
