import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	AuthorizationError,
	BusinessLogicError,
} from '../middleware/errorHandler'
import Tenant from '../models/Tenant'
import TenantRolePermission from '../models/TenantRolePermission'
import { normalizeProductPatchRequest } from '../apis/productHelper/productPatchNormalize'
import {
	allBarcodes,
	barcodeSetsEqual,
	ensurePrintableProductBarcode,
	generatePrintableBarcode,
	normalizeProductBarcodes,
	parseImportBarcodeCell,
	persistableProductBarcode,
	PRINTABLE_BARCODE_MAX_ATTEMPTS,
	resolvedProductBarcode,
} from '../shared/productBarcode'
import { ERROR_CODES } from '../shared/errorCodes'
import { SEE } from '../shared/seeCatalog'
import {
	ensureProductPatchSee,
	invalidateSeeCache,
} from '../shared/seePermissions'
import { getTenantContext } from '../shared/tenant'

vi.mock('../models/Tenant', () => ({
	default: { findOne: vi.fn() },
}))

vi.mock('../models/TenantRolePermission', () => ({
	default: { findOne: vi.fn() },
}))

const context = (tenantId: string) => ({
	allowedFields: [] as string[],
	role: 'cashier' as const,
	tenantId,
})

const stubRoleSee = (see: string[]) => {
	vi.mocked(Tenant.findOne).mockReturnValue({
		lean: () =>
			Promise.resolve({
				tenantId: 'shop',
				name: 'Shop',
				domain: 'shop.test',
				accessiblePages: ['PRODUCTS'],
			}),
	} as never)

	vi.mocked(TenantRolePermission.findOne).mockReturnValue({
		lean: () => Promise.resolve({ see }),
	} as never)
}

afterEach(() => {
	invalidateSeeCache('tenant-print')
	invalidateSeeCache('tenant-edit')
	invalidateSeeCache('tenant-deny')
	invalidateSeeCache('tenant-a')
	vi.clearAllMocks()
})

describe('productBarcode', () => {
	it('never persists whitespace or a product-id placeholder', () => {
		expect(resolvedProductBarcode('prod-1', undefined)).toBe('')
		expect(resolvedProductBarcode('prod-1', '   ')).toBe('')
		expect(resolvedProductBarcode('prod-1', 'prod-1')).toBe('')
		expect(resolvedProductBarcode('prod-1', '001070002')).toBe('001070002')
		expect(persistableProductBarcode('prod-1', undefined)).toBeUndefined()
		expect(persistableProductBarcode('prod-1', '   ')).toBeUndefined()
		expect(persistableProductBarcode('prod-1', 'prod-1')).toBeUndefined()
		expect(persistableProductBarcode('prod-1', '001070002')).toBe('001070002')
	})

	it('allBarcodes normalizes, dedupes case-insensitively, and promotes primary', () => {
		expect(
			allBarcodes({
				productId: 'prod-1',
				barcode: ' 123 ',
				additionalBarcodes: ['456', '123', 'ABC', 'abc', 'prod-1', ''],
			}),
		).toEqual(['123', '456', 'ABC'])

		expect(normalizeProductBarcodes('prod-1', '', ['456', '789'])).toEqual({
			barcode: '456',
			additionalBarcodes: ['789'],
		})

		expect(
			barcodeSetsEqual(
				'prod-1',
				{ barcode: '123', additionalBarcodes: ['456', '789'] },
				{ barcode: '789', additionalBarcodes: ['123', '456'] },
			),
		).toBe(true)
	})

	it('rejects more than 10 unique barcodes and parses import cells', () => {
		const eleven = Array.from({ length: 11 }, (_, i) => String(i + 1))

		expect(() =>
			normalizeProductBarcodes('prod-1', eleven[0], eleven.slice(1)),
		).toThrow(/at most 10/)

		expect(parseImportBarcodeCell('prod-1', '123;456;789')).toEqual({
			barcode: '123',
			additionalBarcodes: ['456', '789'],
		})

		expect(parseImportBarcodeCell('prod-1', eleven.join(';')).error).toMatch(
			/at most 10/,
		)
	})

	it('generates a printable CODE128 value that is not the product id', () => {
		const productId = 'prod-1'
		const barcode = generatePrintableBarcode()

		expect(barcode).not.toBe(productId)
		expect(barcode).toMatch(/^\d{9}$/)
		expect(resolvedProductBarcode(productId, barcode)).toBe(barcode)
	})

	it('PATCH persist uses the same empty-or-real barcode rules', () => {
		expect(
			persistableProductBarcode(
				'prod-1',
				normalizeProductPatchRequest({ barcode: 'prod-1' }).barcode,
			),
		).toBeUndefined()

		expect(
			persistableProductBarcode(
				'prod-1',
				normalizeProductPatchRequest({ barcode: '   ' }).barcode,
			),
		).toBeUndefined()

		expect(
			persistableProductBarcode(
				'prod-1',
				normalizeProductPatchRequest({ barcode: '001070002' }).barcode,
			),
		).toBe('001070002')
	})
})

describe('ensurePrintableProductBarcode', () => {
	const available = async () => undefined

	it('generates and persists when barcode is empty or a product-id placeholder', async () => {
		stubRoleSee([SEE.productsPrintBarcode])
		const persistBarcode = vi.fn()

		const empty = await ensurePrintableProductBarcode(
			'prod-1',
			context('tenant-print'),
			{
				findProduct: async () => ({ barcode: '' }),
				assertBarcodeAvailable: available,
				persistBarcode,
			},
		)
		const legacy = await ensurePrintableProductBarcode(
			'prod-1',
			context('tenant-print'),
			{
				findProduct: async () => ({ barcode: 'prod-1' }),
				assertBarcodeAvailable: available,
				persistBarcode,
			},
		)

		expect(empty.barcode).not.toBe('prod-1')
		expect(empty.barcode).toMatch(/^\d{9}$/)
		expect(legacy.barcode).not.toBe('prod-1')
		expect(persistBarcode).toHaveBeenCalledTimes(2)
		expect(persistBarcode).toHaveBeenCalledWith('prod-1', empty.barcode)
	})

	it('returns an existing barcode without writing', async () => {
		stubRoleSee([SEE.productsPrintBarcode])
		const persistBarcode = vi.fn()
		const assertBarcodeAvailable = vi.fn()

		const result = await ensurePrintableProductBarcode(
			'prod-1',
			context('tenant-print'),
			{
				findProduct: async () => ({ barcode: '001070002' }),
				assertBarcodeAvailable,
				persistBarcode,
			},
		)

		expect(result).toEqual({ barcode: '001070002' })
		expect(persistBarcode).not.toHaveBeenCalled()
		expect(assertBarcodeAvailable).not.toHaveBeenCalled()
	})

	it('rejects a missing product without writing', async () => {
		stubRoleSee([SEE.productsPrintBarcode])
		const persistBarcode = vi.fn()

		await expect(
			ensurePrintableProductBarcode('prod-1', context('tenant-print'), {
				findProduct: async () => null,
				assertBarcodeAvailable: available,
				persistBarcode,
			}),
		).rejects.toMatchObject({
			httpStatus: 422,
			message: 'products not found.',
		})

		expect(persistBarcode).not.toHaveBeenCalled()
	})

	it('rejects generate without products.printBarcode', async () => {
		stubRoleSee([])
		const persistBarcode = vi.fn()

		await expect(
			ensurePrintableProductBarcode('prod-1', context('tenant-deny'), {
				findProduct: async () => ({ barcode: '' }),
				assertBarcodeAvailable: available,
				persistBarcode,
			}),
		).rejects.toBeInstanceOf(AuthorizationError)

		expect(persistBarcode).not.toHaveBeenCalled()
	})

	it('generates with printBarcode and without products.edit.barcode', async () => {
		stubRoleSee([SEE.productsPrintBarcode])
		const persistBarcode = vi.fn()

		const result = await ensurePrintableProductBarcode(
			'prod-1',
			context('tenant-print'),
			{
				findProduct: async () => ({ barcode: '' }),
				assertBarcodeAvailable: available,
				persistBarcode,
			},
		)

		expect(result.barcode).toMatch(/^\d{9}$/)
		expect(persistBarcode).toHaveBeenCalledTimes(1)
		await expect(
			ensureProductPatchSee(
				context('tenant-print'),
				{ barcode: '001070002' },
				{ barcode: '' },
			),
		).rejects.toBeInstanceOf(AuthorizationError)
	})

	it('retries when a generated barcode collides then persists a free one', async () => {
		stubRoleSee([SEE.productsPrintBarcode])
		const persistBarcode = vi.fn()
		const assertBarcodeAvailable = vi
			.fn()
			.mockRejectedValueOnce(
				new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					'Barcode "001070002" is already used by another product.',
				),
			)
			.mockResolvedValueOnce(undefined)
		const generateBarcode = vi
			.fn()
			.mockReturnValueOnce('001070002')
			.mockReturnValueOnce('009990001')

		const result = await ensurePrintableProductBarcode(
			'prod-1',
			context('tenant-print'),
			{
				findProduct: async () => ({ barcode: '' }),
				assertBarcodeAvailable,
				generateBarcode,
				persistBarcode,
			},
		)

		expect(result).toEqual({ barcode: '009990001' })
		expect(assertBarcodeAvailable).toHaveBeenCalledTimes(2)
		expect(assertBarcodeAvailable).toHaveBeenNthCalledWith(1, '001070002')
		expect(assertBarcodeAvailable).toHaveBeenNthCalledWith(2, '009990001')
		expect(persistBarcode).toHaveBeenCalledTimes(1)
		expect(persistBarcode).toHaveBeenCalledWith('prod-1', '009990001')
	})

	it('retries when collision is against another product additional barcode', async () => {
		stubRoleSee([SEE.productsPrintBarcode])
		const persistBarcode = vi.fn()
		const assertBarcodeAvailable = vi
			.fn()
			.mockRejectedValueOnce(
				new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					'Barcode "EXTRA-9" is already used by another product.',
				),
			)
			.mockResolvedValueOnce(undefined)

		const result = await ensurePrintableProductBarcode(
			'prod-1',
			context('tenant-print'),
			{
				findProduct: async () => ({ barcode: '' }),
				assertBarcodeAvailable,
				generateBarcode: vi
					.fn()
					.mockReturnValueOnce('EXTRA-9')
					.mockReturnValueOnce('FREE-1'),
				persistBarcode,
			},
		)

		expect(result).toEqual({ barcode: 'FREE-1' })
		expect(persistBarcode).toHaveBeenCalledWith('prod-1', 'FREE-1')
	})

	it('propagates non-collision assert errors without persisting', async () => {
		stubRoleSee([SEE.productsPrintBarcode])
		const persistBarcode = vi.fn()

		await expect(
			ensurePrintableProductBarcode('prod-1', context('tenant-print'), {
				findProduct: async () => ({ barcode: '' }),
				assertBarcodeAvailable: async () => {
					throw new BusinessLogicError(
						ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
						'currency settings missing.',
					)
				},
				persistBarcode,
			}),
		).rejects.toMatchObject({ message: 'currency settings missing.' })

		expect(persistBarcode).not.toHaveBeenCalled()
	})

	it('fails after the max collision retries', async () => {
		stubRoleSee([SEE.productsPrintBarcode])
		const persistBarcode = vi.fn()
		const assertBarcodeAvailable = vi
			.fn()
			.mockRejectedValue(
				new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					'Barcode "001070002" is already used by another product.',
				),
			)

		await expect(
			ensurePrintableProductBarcode('prod-1', context('tenant-print'), {
				findProduct: async () => ({ barcode: '' }),
				assertBarcodeAvailable,
				generateBarcode: () => '001070002',
				persistBarcode,
			}),
		).rejects.toMatchObject({
			message: 'Could not generate a unique printable barcode.',
		})

		expect(assertBarcodeAvailable).toHaveBeenCalledTimes(
			PRINTABLE_BARCODE_MAX_ATTEMPTS,
		)

		expect(persistBarcode).not.toHaveBeenCalled()
	})

	it('allows a manual PATCH barcode when the role has edit.barcode', async () => {
		stubRoleSee([SEE.productsEdit, SEE.productsEditBarcode])

		await expect(
			ensureProductPatchSee(
				context('tenant-edit'),
				{ barcode: '001070002' },
				{ barcode: '' },
			),
		).resolves.toBeUndefined()
	})

	it('looks up the request tenant and does not write across tenants', async () => {
		stubRoleSee([SEE.productsPrintBarcode])
		const persistBarcode = vi.fn()
		const findProduct = vi.fn(async () => null)

		await expect(
			ensurePrintableProductBarcode('prod-1', context('tenant-a'), {
				findProduct,
				assertBarcodeAvailable: available,
				persistBarcode,
			}),
		).rejects.toBeInstanceOf(BusinessLogicError)

		expect(findProduct).toHaveBeenCalledWith('prod-1', 'tenant-a')
		expect(persistBarcode).not.toHaveBeenCalled()
	})
})

describe('getTenantContext', () => {
	it('throws when tenantId is missing', () => {
		expect(() =>
			getTenantContext({
				allowedFields: [],
				role: 'owner',
			} as never),
		).toThrow(AuthorizationError)
	})
})
