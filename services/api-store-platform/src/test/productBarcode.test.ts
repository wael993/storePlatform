import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	AuthorizationError,
	BusinessLogicError,
} from '../middleware/errorHandler'
import Tenant from '../models/Tenant'
import TenantRolePermission from '../models/TenantRolePermission'
import { normalizeProductPatchRequest } from '../apis/productHelper/productPatchNormalize'
import {
	ensurePrintableProductBarcode,
	generatePrintableBarcode,
	persistableProductBarcode,
	resolvedProductBarcode,
} from '../shared/productBarcode'
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
	it('generates and persists when barcode is empty or a product-id placeholder', async () => {
		stubRoleSee([SEE.productsPrintBarcode])
		const persistBarcode = vi.fn()

		const empty = await ensurePrintableProductBarcode(
			'prod-1',
			context('tenant-print'),
			{
				findProduct: async () => ({ barcode: '' }),
				persistBarcode,
			},
		)
		const legacy = await ensurePrintableProductBarcode(
			'prod-1',
			context('tenant-print'),
			{
				findProduct: async () => ({ barcode: 'prod-1' }),
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

		const result = await ensurePrintableProductBarcode(
			'prod-1',
			context('tenant-print'),
			{
				findProduct: async () => ({ barcode: '001070002' }),
				persistBarcode,
			},
		)

		expect(result).toEqual({ barcode: '001070002' })
		expect(persistBarcode).not.toHaveBeenCalled()
	})

	it('rejects a missing product without writing', async () => {
		stubRoleSee([SEE.productsPrintBarcode])
		const persistBarcode = vi.fn()

		await expect(
			ensurePrintableProductBarcode('prod-1', context('tenant-print'), {
				findProduct: async () => null,
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
