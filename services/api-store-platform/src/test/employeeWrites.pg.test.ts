import { randomUUID } from 'crypto'
import { afterAll, describe, expect, it, vi } from 'vitest'

import EmployeeController from '../apis/employee/api.controller'
import { closeDb } from '../db'
import { insertDoc } from '../db/docs'
import { pgFindOne } from '../db/mongoQuery'
import { Currency } from '../models/Currency'
import { Employee } from '../models/Employee'
import type { RequestContext } from '../shared/types'

// SEE checks are covered elsewhere; here only the writes matter
vi.mock('../shared/seePermissions', () => ({ ensureSeeIds: vi.fn() }))

const enabled = Boolean(process.env.DATABASE_URL)
const actor = { _id: 'u-1', displayName: 'Ana', createdAt: new Date() }

const setup = async () => {
	const tenantId = `t-${randomUUID()}`
	const ctx = { tenantId, role: 'owner', userId: 'u-1' } as RequestContext
	const controller = new EmployeeController()

	await insertDoc(Currency, {
		_id: `${tenantId}-usd`,
		tenantId,
		currencyId: 'usd',
		name: 'USD',
		createdBy: actor,
	})

	const { employeeId } = await controller.postEmployee(ctx, {
		name: 'Sami Nour',
		employmentType: 'full_time',
		status: 'terminated',
		startDate: '2026-01-01',
		endDate: '2026-10-01',
		workStart: '09:00',
		workEnd: '17:00',
	})

	return { tenantId, ctx, controller, employeeId }
}

describe.skipIf(!enabled)('employee writes (Postgres)', () => {
	afterAll(closeDb)

	it('clears fields that were set to undefined (reactivate, empty work hours)', async () => {
		const { tenantId, ctx, controller, employeeId } = await setup()

		await controller.patchEmployee(employeeId, ctx, {
			status: 'active',
			workStart: '',
		})

		const saved = await pgFindOne(Employee, tenantId, { employeeId })

		expect(saved.status).toBe('active')
		expect(saved.endDate).toBeUndefined()
		expect(saved.workStart).toBeUndefined()
		expect(saved.workEnd).toBe('17:00')
	})

	it('keeps both payouts when two are posted at the same time', async () => {
		const { tenantId, ctx, controller, employeeId } = await setup()
		const payout = (amount: number) =>
			controller.postPayout(employeeId, ctx, {
				amount,
				currencyId: 'usd',
				date: '2026-11-01',
			})

		await Promise.all([payout(10), payout(20), payout(30)])

		const saved = await pgFindOne(Employee, tenantId, { employeeId })

		expect(
			saved.payouts.map((p: { amount: number }) => p.amount).sort(),
		).toEqual([10, 20, 30])
	})
})
