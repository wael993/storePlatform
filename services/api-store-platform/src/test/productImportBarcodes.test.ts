import { describe, expect, it, vi } from 'vitest'

import { BusinessLogicError } from '../middleware/errorHandler'
import { ERROR_CODES } from '../shared/errorCodes'
import { assertNoTenantBarcodeCollisionsForProducts } from '../shared/productBarcodeCollision'
import {
	applyImportBarcodeCollisions,
	mapSourceRows,
} from '../shared/productImport/mapRows'

describe('product import barcodes', () => {
	it('splits delimited barcodes and rejects row collisions', () => {
		const mapped = mapSourceRows(
			[
				{
					fileName: 'a.xlsx',
					rowNumber: 1,
					values: {
						Name: 'Milk',
						Barcode: '123;222',
						Price: '10',
					},
				},
				{
					fileName: 'a.xlsx',
					rowNumber: 2,
					values: {
						Name: 'Bread',
						Barcode: '999;123',
						Price: '5',
					},
				},
			],
			{
				name: 'Name',
				barcode: 'Barcode',
				retailPrice: 'Price',
			},
		)

		expect(mapped[0].barcode).toBe('123')
		expect(mapped[0].additionalBarcodes).toEqual(['222'])
		expect(mapped[1].barcode).toBe('999')
		expect(mapped[1].additionalBarcodes).toEqual(['123'])

		const withCollisions = applyImportBarcodeCollisions(mapped)

		expect(withCollisions[0].errors).toEqual([])
		expect(withCollisions[1].errors.some(e => e.includes('123'))).toBe(true)
	})

	it('rejects barcodes already on tenant products', () => {
		const mapped = mapSourceRows(
			[
				{
					fileName: 'a.xlsx',
					rowNumber: 1,
					values: { Name: 'Milk', Barcode: 'EXISTING', Price: '1' },
				},
			],
			{ name: 'Name', barcode: 'Barcode', retailPrice: 'Price' },
		)
		const existing = new Set(['existing'])
		const result = applyImportBarcodeCollisions(mapped, existing)

		expect(result[0].errors.some(e => e.includes('EXISTING'))).toBe(true)
	})

	it('write-path batch assert calls per-product collision check', async () => {
		const assertOne = vi.fn().mockResolvedValue(undefined)

		await assertNoTenantBarcodeCollisionsForProducts(
			'tenant-a',
			[
				{
					productId: 'new-1',
					barcode: '111',
					additionalBarcodes: ['222'],
				},
			],
			assertOne,
		)

		expect(assertOne).toHaveBeenCalledWith('tenant-a', ['111', '222'], 'new-1')
	})

	it('write-path batch assert propagates collision errors', async () => {
		const assertOne = vi
			.fn()
			.mockRejectedValue(
				new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					'Barcode "EXISTING" is already used by another product.',
				),
			)

		await expect(
			assertNoTenantBarcodeCollisionsForProducts(
				'tenant-a',
				[{ productId: 'new-1', barcode: 'EXISTING', additionalBarcodes: [] }],
				assertOne,
			),
		).rejects.toBeInstanceOf(BusinessLogicError)
	})
})
