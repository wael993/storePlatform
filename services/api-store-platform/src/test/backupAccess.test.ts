import express from 'express'
import { describe, expect, it, vi } from 'vitest'

import ActivityAuthorization from '../apis/api.authorize'
import type ProductController from '../apis/api.controller'
import BackupController from '../apis/backup/api.controller'
import {
	BACKUP_STALE_MS,
	isRestoreLockLive,
	restoreChangedSince,
} from '../shared/backup/constants'
import { RequestContext } from '../shared/types'

vi.mock('../shared/seePermissions', () => ({
	getSeeSet: async () => new Set(),
	invalidateSeeCache: () => undefined,
}))

/** Runs the auth middleware for an owner of a tenant whose restore lock is (not) live. */
const authorize = async (method: string, restoreInProgress: boolean) => {
	const controller = {
		validateUser: async () => ({ tenantId: 't1', role: 'owner' }),
		getTenantRequestAccess: async () => ({
			accessiblePages: ['PRODUCTS', 'BACKUP'],
			subscriptionExpired: false,
			restoreInProgress,
		}),
	} as unknown as ProductController
	const response = {
		statusCode: 200,
		status(code: number) {
			this.statusCode = code

			return this
		},
		json: vi.fn(),
	}
	const next = vi.fn()

	await new ActivityAuthorization(controller).authorizationValidator(
		{
			method,
			path: '/api/data/products',
			headers: { authorization: 'Bearer token' },
		},
		response as unknown as express.Response,
		next,
	)

	return { status: response.statusCode, passed: next.mock.calls.length === 1 }
}

describe('restore write lock', () => {
	it('answers 423 to writes while a restore runs, reads still pass', async () => {
		expect(await authorize('POST', true)).toEqual({ status: 423, passed: false })
		expect(await authorize('GET', true)).toEqual({ status: 200, passed: true })
		expect(await authorize('POST', false)).toEqual({ status: 200, passed: true })
	})

	it('counts the lock as live only while its heartbeat is fresh', () => {
		expect(isRestoreLockLive(new Date())).toBe(true)
		expect(isRestoreLockLive(new Date(Date.now() - BACKUP_STALE_MS - 1))).toBe(false)
		expect(isRestoreLockLive(null)).toBe(false)
	})
})

describe('sync reset after a restore', () => {
	const since = new Date('2026-11-19T10:00:00Z')

	it('asks devices to re-download when a restore started or finished after their last pull', () => {
		expect(restoreChangedSince({ startedAt: '2026-11-19T10:05:00Z' }, since)).toBe(true)
		expect(
			restoreChangedSince(
				{ startedAt: '2026-11-19T09:00:00Z', finishedAt: '2026-11-19T10:01:00Z' },
				since,
			),
		).toBe(true)

		expect(
			restoreChangedSince(
				{ startedAt: '2026-11-19T09:00:00Z', finishedAt: '2026-11-19T09:30:00Z' },
				since,
			),
		).toBe(false)

		expect(restoreChangedSince(null, since)).toBe(false)
	})
})

describe('backup ACL', () => {
	it.each(['admin', 'cashier', 'employee', 'super_admin'])(
		'refuses every backup endpoint to %s (owner only)',
		async role => {
			const controller = new BackupController()
			const context = { role, tenantId: 't1' } as unknown as RequestContext

			await expect(controller.getSettings(context)).rejects.toMatchObject({
				httpStatus: 403,
			})

			await expect(controller.restore('b1', context)).rejects.toMatchObject({
				httpStatus: 403,
			})

			await expect(controller.runBackup(context)).rejects.toMatchObject({
				httpStatus: 403,
			})
		},
	)
})
