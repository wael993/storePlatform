import { describe, expect, it } from 'vitest'
import {
	mapSourceRows,
	parseImportNumber,
	toPlainSourceRow,
} from '../shared/productImport/mapRows'
import {
	proposeMasterMatches,
	resolveCreateMasterName,
} from '../shared/productImport/masterData'

describe('mapSourceRows', () => {
	it('reads mapped headers and resolves master ids', () => {
		const [row] = mapSourceRows(
			[
				{
					fileName: 'items.xlsx',
					rowNumber: 2,
					values: {
						Name: 'Tea',
						Sell: '10',
						Qty: '3',
						Category: 'Drinks',
						Unit: 'Piece',
					},
				},
			],
			{
				name: 'Name',
				retailPrice: 'Sell',
				quantity: 'Qty',
				category: 'Category',
				unit: 'Unit',
			},
			{
				category: { drinks: 'cat-1' },
				unit: { piece: 'unit-1' },
			},
		)

		expect(row.name).toBe('Tea')
		expect(row.retailPrice).toBe(10)
		expect(row.quantity).toBe(3)
		expect(row.categoryId).toBe('cat-1')
		expect(row.unitId).toBe('unit-1')
		expect(row.errors).toEqual([])
	})

	it('errors when mapped master value is unresolved', () => {
		const [row] = mapSourceRows(
			[
				{
					fileName: 'items.xlsx',
					rowNumber: 2,
					values: { Name: 'Tea', Sell: '10', Category: 'Missing' },
				},
			],
			{ name: 'Name', retailPrice: 'Sell', category: 'Category' },
		)

		expect(row.errors.some(e => e.includes('Category'))).toBe(true)
	})

	it('allows skipped master values after confirm (empty resolutions map)', () => {
		const [row] = mapSourceRows(
			[
				{
					fileName: 'items.xlsx',
					rowNumber: 2,
					values: { Name: 'Tea', Sell: '10', Category: 'Missing' },
				},
			],
			{ name: 'Name', retailPrice: 'Sell', category: 'Category' },
			{ category: {} },
		)

		expect(row.categoryId).toBeUndefined()
		expect(row.errors).toEqual([])
	})

	it('parses currency-decorated prices and rejects junk without silent 0', () => {
		const [ok, bad] = mapSourceRows(
			[
				{
					fileName: 'items.xlsx',
					rowNumber: 2,
					values: {
						Name: 'Milk',
						Sell: '$12.50',
						Buy: '1,500 USD',
					},
				},
				{
					fileName: 'items.xlsx',
					rowNumber: 3,
					values: {
						Name: 'Bread',
						Sell: '$abc',
						Buy: '12abc',
					},
				},
			],
			{
				name: 'Name',
				retailPrice: 'Sell',
				purchasePrice: 'Buy',
			},
		)

		expect(ok.retailPrice).toBe(12.5)
		expect(ok.purchasePrice).toBe(1500)
		expect(ok.errors).toEqual([])

		expect(bad.errors.some(e => e.includes('retail price'))).toBe(true)
		expect(bad.errors.some(e => e.includes('purchase price'))).toBe(true)
		expect(bad.purchasePrice).toBeUndefined()
	})
})

describe('parseImportNumber', () => {
	it('normalizes symbols, codes, and locales without wiping junk', () => {
		expect(parseImportNumber('$12.50')).toBe(12.5)
		expect(parseImportNumber('$1,500')).toBe(1500)
		expect(parseImportNumber('12.50 USD')).toBe(12.5)
		expect(parseImportNumber('1.500,00')).toBe(1500)
		expect(parseImportNumber('0')).toBe(0)
		expect(parseImportNumber('12abc')).toBeNull()
		expect(parseImportNumber('$abc')).toBeNull()
	})
})

describe('proposeMasterMatches', () => {
	it('matches, creates, and surfaces ambiguous names', () => {
		const proposals = proposeMasterMatches(
			'unit',
			['Piece', 'Kg', 'box', 'Box'],
			[
				{ id: 'u1', name: 'Piece' },
				{ id: 'u2', name: 'box' },
				{ id: 'u3', name: 'BOX' },
			],
		)

		expect(proposals.find(p => p.excelValue === 'Piece')?.status).toBe('match')
		expect(proposals.find(p => p.excelValue === 'Kg')?.status).toBe('create')
		expect(proposals.find(p => p.excelValue === 'box')?.status).toBe(
			'ambiguous',
		)

		expect(proposals.filter(p => p.normalized === 'box')).toHaveLength(1)
	})
})

describe('resolveCreateMasterName', () => {
	it('prefers createName and falls back to excelValue', () => {
		expect(
			resolveCreateMasterName({
				kind: 'category',
				excelValue: 'Drinks',
				action: 'create',
				createName: ' Soft drinks ',
			}),
		).toBe('Soft drinks')

		expect(
			resolveCreateMasterName({
				kind: 'unit',
				excelValue: ' Kg ',
				action: 'create',
			}),
		).toBe('Kg')
	})
})

describe('toPlainSourceRow', () => {
	it('keeps getter-backed values that object spread drops', () => {
		const row = Object.create(null, {
			fileName: { get: () => 'items.xlsx', enumerable: false },
			rowNumber: { get: () => 2, enumerable: false },
			values: {
				get: () => ({ Name: 'Tea' }),
				enumerable: false,
			},
		}) as {
			fileName: string
			rowNumber: number
			values?: Record<string, string>
		}

		expect({ ...row }.values).toBeUndefined()

		const plain = toPlainSourceRow(row, 0)

		expect(plain.values?.Name).toBe('Tea')
		expect(plain.fileIndex).toBe(0)
	})
})
