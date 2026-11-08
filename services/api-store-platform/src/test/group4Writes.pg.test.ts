import { randomUUID } from 'crypto'
import { afterAll, describe, expect, it } from 'vitest'

import {
	ALL_TENANTS,
	closeDb,
	DbTx,
	inTransaction,
	isUniqueViolation,
} from '../db'
import { insertDoc } from '../db/docs'
import {
	pgDeleteMany,
	pgFind,
	pgFindOne,
	pgFindOneAndDelete,
	pgFindOneAndUpdate,
} from '../db/mongoQuery'
import RefreshToken from '../models/RefreshToken'
import SubscriptionRenewalRequest from '../models/SubscriptionRenewalRequest'
import Tenant from '../models/Tenant'
import User from '../models/User'
import {
	newInvoiceAiUsage,
	reserveInvoiceAiCredit,
} from '../shared/invoiceAi/usage'

/** Group 4 write paths the read-only api:diff cannot cover. */
const enabled = Boolean(process.env.DATABASE_URL)
const created: string[] = []

const newTenant = async (extra: Record<string, unknown> = {}) => {
	const tenantId = `t-${randomUUID()}`

	created.push(tenantId)

	await insertDoc(Tenant, {
		tenantId,
		name: tenantId,
		domain: `${tenantId}.test`,
		...extra,
	})

	return tenantId
}

describe.skipIf(!enabled)('group 4 writes (Postgres)', () => {
	// platform lists (all tenants) must not show test tenants, e.g. in api:diff
	afterAll(async () => {
		for (const model of [
			User,
			RefreshToken,
			SubscriptionRenewalRequest,
			Tenant,
		]) {
			await pgDeleteMany(model, ALL_TENANTS, { tenantId: { $in: created } })
		}

		await closeDb()
	})

	it('scopes by tenant unless ALL_TENANTS is passed on purpose', async () => {
		const tenantId = await newTenant()
		const domain = `${tenantId}.test`

		await expect(pgFind(Tenant, undefined, { domain })).rejects.toThrow(
			'missing tenant context',
		)

		expect(await pgFindOne(Tenant, 'other-tenant', { domain })).toBeNull()
		expect(await pgFindOne(Tenant, ALL_TENANTS, { domain })).toMatchObject({
			tenantId,
		})
	})

	it('returns created docs with timestamps, like save()', async () => {
		const tenantId = await newTenant()
		const user = await insertDoc(User, {
			tenantId,
			userId: randomUUID(),
			displayName: 'Ana Lima',
			user: { firstName: 'Ana', lastName: 'Lima' },
			email: `ana@${tenantId}.test`,
			password: 'hashed-secret',
			createdBy: { _id: 'seed', displayName: 'seed', createdAt: new Date() },
		})

		expect(user.createdAt).toBeInstanceOf(Date)
		expect(
			await pgFindOne(User, tenantId, { 'user.firstName': 'Ana' }),
		).toMatchObject({ user: { firstName: 'Ana', lastName: 'Lima' } })
	})

	it('rotates a refresh token once when two refreshes race', async () => {
		const tenantId = await newTenant()
		const tokenHash = randomUUID()

		await insertDoc(RefreshToken, {
			tenantId,
			userId: '0123456789abcdef01234567', // users._id (ObjectId hex)
			tokenHash,
			ip: '127.0.0.1',
			userAgent: 'test',
			expiresAt: new Date(Date.now() + 60_000),
		})

		const rotate = (tx?: DbTx) =>
			pgFindOneAndDelete(RefreshToken, ALL_TENANTS, { tokenHash }, tx)
		let second: ReturnType<typeof rotate> | undefined

		// the first refresh holds the token while the second one tries
		const first = await inTransaction(undefined, async tx => {
			const won = await rotate(tx)

			second = rotate()
			await new Promise(resolve => setTimeout(resolve, 200))

			return won
		})

		expect(first).not.toBeNull()
		expect(await second).toBeNull()
	})

	it('never reserves more Invoice AI credits than the allowance', async () => {
		const tenantId = await newTenant({
			invoiceAi: newInvoiceAiUsage(2, new Date()),
		})

		const results = await Promise.allSettled(
			Array.from({ length: 5 }, () => reserveInvoiceAiCredit(tenantId)),
		)
		const tenant = await pgFindOne(Tenant, tenantId)

		expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(2)
		expect(tenant.invoiceAi.usedInPeriod).toBe(2)
	})

	it('allows one pending renewal request per tenant and one approval', async () => {
		const tenantId = await newTenant()
		const request = () =>
			insertDoc(SubscriptionRenewalRequest, {
				requestId: randomUUID(),
				tenantId,
				tenantName: 'Shop',
				requestedBy: { userId: 'u-1', displayName: 'Ana' },
				currentExpirationDate: new Date(),
				status: 'pending',
				requestedAt: new Date(),
			})

		const { requestId } = await request()

		await expect(request()).rejects.toSatisfy(isUniqueViolation)

		const approve = () =>
			pgFindOneAndUpdate(
				SubscriptionRenewalRequest,
				ALL_TENANTS,
				{ requestId, status: 'pending' },
				{
					$set: {
						status: 'approved',
						reviewedBy: { userId: 'admin', displayName: 'Admin' },
					},
				},
				{ new: true },
			)
		const claims = await Promise.all([approve(), approve()])

		expect(claims.filter(Boolean)).toHaveLength(1)
		expect(claims.find(Boolean)).toMatchObject({
			reviewedBy: { userId: 'admin' },
		})
	})
})
