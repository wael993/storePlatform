import { describe, expect, it } from 'vitest'
import {
	mapSourceRows,
	toPlainSourceRow,
} from '../shared/productImport/mapRows'

const noCatalog = () => ({})

describe('mapSourceRows', () => {
	it('reads Arabic mapped headers from row.values', () => {
		const [row] = mapSourceRows(
			[
				{
					fileName: 'items.xlsx',
					rowNumber: 2,
					values: {
						'اسم المادة': 'Tea',
						السعر7: '10',
						الكمية: '3',
					},
				},
			],
			{
				name: 'اسم المادة',
				retailPrice: 'السعر7',
				quantity: 'الكمية',
			},
			noCatalog,
		)

		expect(row.name).toBe('Tea')
		expect(row.retailPrice).toBe(10)
		expect(row.quantity).toBe(3)
		expect(row.errors).toEqual([])
	})

	it('does not throw when values is missing', () => {
		const [row] = mapSourceRows(
			[
				{
					fileName: 'items.xlsx',
					rowNumber: 2,
					values: undefined,
				},
			],
			{ name: 'اسم المادة', retailPrice: 'السعر7' },
			noCatalog,
		)

		expect(row.errors).toContain('Product name is required.')
	})
})

describe('toPlainSourceRow', () => {
	it('keeps getter-backed values that object spread drops', () => {
		const row = Object.create(null, {
			fileName: { get: () => 'items.xlsx', enumerable: false },
			rowNumber: { get: () => 2, enumerable: false },
			values: {
				get: () => ({ 'اسم المادة': 'Tea' }),
				enumerable: false,
			},
		}) as {
			fileName: string
			rowNumber: number
			values?: Record<string, string>
		}

		expect({ ...row }.values).toBeUndefined()

		const plain = toPlainSourceRow(row, 0)

		expect(plain.values?.['اسم المادة']).toBe('Tea')
		expect(plain.fileIndex).toBe(0)
	})
})
