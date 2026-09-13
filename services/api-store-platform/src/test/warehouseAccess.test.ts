import { describe, expect, it } from 'vitest'

import {
	ensureWarehouseAccess,
	ensureWarehouseAcl,
	filterByAccessibleProductIds,
	filterByWarehouseAccess,
	filterByWarehouseAcl,
	getAllowedWarehouseIds,
	getEffectiveWarehouseIds,
	parseWarehouseScopeHeader,
	requireOperationalWarehouseId,
	requireWarehouseId,
	resolveWarehouseScope,
} from '../shared/warehouseAccess'
import { RequestContext } from '../shared/types'

const ownerCtx = {
	role: 'owner',
	user: { warehouseIds: [] },
	allowedFields: [],
} as unknown as RequestContext

const clerkCtx = {
	role: 'cashier',
	user: { warehouseIds: ['w1', 'w2'] },
	allowedFields: [],
} as unknown as RequestContext

const op = {
	...clerkCtx,
	warehouseScope: ['w1'],
} as RequestContext

describe('warehouseAccess', () => {
	it('parses a scope header', () => {
		expect(parseWarehouseScopeHeader('w1, w2')).toEqual(['w1', 'w2'])
		expect(parseWarehouseScopeHeader(['w1', 'w2'])).toEqual(['w1', 'w2'])
		expect(parseWarehouseScopeHeader(encodeURIComponent('المستودع'))).toEqual([
			'المستودع',
		])

		expect(parseWarehouseScopeHeader('%ZZ')).toEqual(['%ZZ'])
		expect(parseWarehouseScopeHeader(undefined)).toBeUndefined()
	})

	it('resolves scope from ACL and never lets a header widen it', () => {
		expect(resolveWarehouseScope(ownerCtx, undefined)).toBeNull()
		expect(resolveWarehouseScope(ownerCtx, 'w1')).toEqual(['w1'])
		expect(resolveWarehouseScope(clerkCtx, undefined)).toEqual(['w1', 'w2'])
		expect(resolveWarehouseScope(clerkCtx, 'w1')).toEqual(['w1'])
		expect(resolveWarehouseScope(clerkCtx, 'w9')).toEqual([])
		expect(resolveWarehouseScope(clerkCtx, 'w1,w9')).toEqual(['w1'])
		expect(
			resolveWarehouseScope(
				{
					role: 'super_admin',
					user: { warehouseIds: [] },
				} as unknown as RequestContext,
				undefined,
			),
		).toBeNull()

		expect(
			getAllowedWarehouseIds({
				role: 'cashier',
				user: { warehouseIds: undefined },
				allowedFields: [],
			} as unknown as RequestContext),
		).toEqual([])
	})

	it('requires exactly one operational warehouse', () => {
		expect(requireWarehouseId('  w1  ')).toBe('w1')
		expect(() => requireWarehouseId('')).toThrow()
		expect(requireOperationalWarehouseId(op)).toBe('w1')
		expect(() =>
			requireOperationalWarehouseId({
				...clerkCtx,
				warehouseScope: ['w1', 'w2'],
			} as RequestContext),
		).toThrow()

		expect(() =>
			requireOperationalWarehouseId({
				...ownerCtx,
				warehouseScope: null,
			} as RequestContext),
		).toThrow()

		expect(getEffectiveWarehouseIds(op)).toEqual(['w1'])
		expect(getEffectiveWarehouseIds(ownerCtx)).toBeNull()
	})

	it('lets working scope narrow access without widening the ACL', () => {
		expect(() => ensureWarehouseAccess(op, 'w1')).not.toThrow()
		expect(() => ensureWarehouseAccess(op, 'w2')).toThrow()
		expect(() => ensureWarehouseAcl(op, 'w2')).not.toThrow()
		expect(() => ensureWarehouseAcl(op, 'w9')).toThrow()
		expect(() => ensureWarehouseAccess(ownerCtx, 'w9')).not.toThrow()
		expect(() => ensureWarehouseAcl(ownerCtx, 'w9')).not.toThrow()
	})

	it('filters stock and products by working scope or ACL', () => {
		const stock = [{ warehouseId: 'w1' }, { warehouseId: 'w2' }, {}]

		expect(filterByWarehouseAccess(op, stock)).toEqual([{ warehouseId: 'w1' }])
		expect(filterByWarehouseAcl(op, stock)).toEqual([
			{ warehouseId: 'w1' },
			{ warehouseId: 'w2' },
		])

		expect(filterByWarehouseAccess(ownerCtx, stock)).toEqual(stock)
		expect(
			filterByWarehouseAccess(
				{ ...clerkCtx, warehouseScope: [] } as RequestContext,
				stock,
			),
		).toEqual([])

		const products = [{ productId: 'p1' }, { productId: 'p2' }]

		expect(filterByAccessibleProductIds(products, null)).toEqual(products)
		expect(filterByAccessibleProductIds(products, [])).toEqual([])
		expect(filterByAccessibleProductIds(products, ['p1'])).toEqual([
			{ productId: 'p1' },
		])
	})
})
