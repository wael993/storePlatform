/**
 * Self-check for warehouse scope resolution (no test framework).
 * Run: npx ts-node src/shared/warehouseAccess.selfcheck.ts
 */
import assert from 'assert'
import {
	getAllowedWarehouseIds,
	parseWarehouseScopeHeader,
	requireOperationalWarehouseId,
	resolveWarehouseScope,
} from './warehouseAccess'
import { RequestContext } from './types'

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

assert.deepEqual(parseWarehouseScopeHeader('w1, w2'), ['w1', 'w2'])
assert.deepEqual(parseWarehouseScopeHeader(encodeURIComponent('المستودع')), [
	'المستودع',
])

assert.equal(parseWarehouseScopeHeader(undefined), undefined)

assert.equal(resolveWarehouseScope(ownerCtx, undefined), null)
assert.deepEqual(resolveWarehouseScope(ownerCtx, 'w1'), ['w1'])
assert.deepEqual(resolveWarehouseScope(clerkCtx, undefined), ['w1', 'w2'])
assert.deepEqual(resolveWarehouseScope(clerkCtx, 'w1'), ['w1'])

// A stale or forged header narrows access; it must never throw, because scope is
// resolved while building the request context, outside the handler's try/catch.
assert.deepEqual(resolveWarehouseScope(clerkCtx, 'w9'), [])
assert.deepEqual(resolveWarehouseScope(clerkCtx, 'w1,w9'), ['w1'])

// Platform staff are unrestricted like the tenant owner.
assert.equal(
	resolveWarehouseScope(
		{
			role: 'super_admin',
			user: { warehouseIds: [] },
		} as unknown as RequestContext,
		undefined,
	),
	null,
)

const op = {
	...clerkCtx,
	warehouseScope: ['w1'],
} as RequestContext

assert.equal(requireOperationalWarehouseId(op), 'w1')

assert.throws(() =>
	requireOperationalWarehouseId({
		...clerkCtx,
		warehouseScope: ['w1', 'w2'],
	} as RequestContext),
)

assert.throws(() =>
	requireOperationalWarehouseId({
		...ownerCtx,
		warehouseScope: null,
	} as RequestContext),
)

assert.deepEqual(
	getAllowedWarehouseIds({
		role: 'cashier',
		user: { warehouseIds: undefined },
		allowedFields: [],
	} as unknown as RequestContext),
	[],
)

console.log('warehouseAccess.selfcheck: ok')
