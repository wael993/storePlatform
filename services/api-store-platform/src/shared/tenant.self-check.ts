/**
 * npx ts-node src/shared/tenant.self-check.ts
 */
import assert from 'assert'
import { RoleRecord } from '../models/Role'
import { buildDynamicMatrixFromRoles } from './tenant'

const allow = (accessLevel: 'GLOBAL' | 'NONE') => ({
	accessLevel,
	fields: accessLevel === 'NONE' ? [] : ['*'],
})

const role = (
	id: string,
	resources: RoleRecord['resources'],
	include: string[] = [],
): RoleRecord => ({
	_id: id,
	name: id,
	resources,
	include,
	frontendResources: {},
})

const run = () => {
	const cashier = role('CASHIER', {
		'/buyingInvoices': {
			GET: allow('GLOBAL'),
			POST: allow('GLOBAL'),
			PATCH: allow('NONE'),
			DELETE: allow('NONE'),
		},
	})
	const owner = role(
		'OWNER',
		{
			'/invoices': {
				GET: allow('GLOBAL'),
				POST: allow('NONE'),
				PATCH: allow('NONE'),
				DELETE: allow('NONE'),
			},
		},
		['CASHIER'],
	)
	const loopA = role('ADMIN', { '/users': { GET: allow('GLOBAL') } }, [
		'EMPLOYEE',
	])
	const loopB = role('EMPLOYEE', { '/products': { GET: allow('GLOBAL') } }, [
		'ADMIN',
	])

	const { matrix, frontendResources } = buildDynamicMatrixFromRoles({
		OWNER: owner,
		CASHIER: cashier,
		ADMIN: loopA,
		EMPLOYEE: loopB,
	})

	assert.deepStrictEqual(matrix.owner.invoices, ['read'])
	assert.deepStrictEqual(matrix.owner.buyingInvoices, ['read', 'create'])
	assert.deepStrictEqual(matrix.cashier.buyingInvoices, ['read', 'create'])
	assert.deepStrictEqual(matrix.cashier.invoices, [])
	assert.ok(!matrix.owner.invoices.includes('create'))

	assert.ok(matrix.admin.users.includes('read'))
	assert.ok(matrix.admin.products.includes('read'))
	assert.ok(matrix.employee.users.includes('read'))
	assert.ok(matrix.employee.products.includes('read'))

	assert.deepStrictEqual(frontendResources.owner, {})

	const missing = buildDynamicMatrixFromRoles({})

	assert.deepStrictEqual(missing.matrix.owner.invoices, [])

	console.log('tenant self-check: ok')
}

run()
