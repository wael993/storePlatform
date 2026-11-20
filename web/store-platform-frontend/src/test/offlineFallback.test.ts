import type { BaseQueryApi } from '@reduxjs/toolkit/query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { handleOfflineQuery } = vi.hoisted(() => ({
	handleOfflineQuery: vi.fn(async () => ({ data: 'local' })),
}))

vi.mock('../offline/localHandlers', () => ({
	handleOfflineQuery,
	isOfflineCapableEndpoint: () => true,
}))
vi.mock('../offline/localStore', () => ({
	isOfflineCapableForTenant: async () => true,
}))

import { baseQueryWithOffline } from '../api/storePlatformApi'
import { getIsNetworkOnline, markOnline } from '../offline/connectivity'

const api = {
	signal: new AbortController().signal,
	abort: vi.fn(),
	dispatch: vi.fn(),
	getState: () => ({
		user: { accessToken: 'token', user: { tenantId: 't1', userId: 'u1' } },
	}),
	extra: undefined,
	endpoint: 'test',
	type: 'query',
} as unknown as BaseQueryApi

const sale = { url: 'selling-invoices', method: 'POST', body: { lines: [] } }

const respond500 = () =>
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('{"message":"boom"}', { status: 500 })),
	)

describe('baseQueryWithOffline on a failed server call', () => {
	beforeEach(() => {
		markOnline()
		handleOfflineQuery.mockClear()
	})
	afterEach(() => vi.unstubAllGlobals())

	it('returns a 500 on a sale as an error and does not save it locally', async () => {
		respond500()

		const result = await baseQueryWithOffline(sale, api, {})

		expect(result.error).toMatchObject({ status: 500 })
		expect(handleOfflineQuery).not.toHaveBeenCalled()
		expect(getIsNetworkOnline()).toBe(true)
	})

	it('answers a read from local data on a 500 without going offline', async () => {
		respond500()

		const result = await baseQueryWithOffline('products', api, {})

		expect(result).toEqual({ data: 'local' })
		expect(getIsNetworkOnline()).toBe(true)
	})

	it('returns a 401 on a sale when the login refresh fails, without saving it locally', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('{"message":"expired"}', { status: 401 })),
		)

		const result = await baseQueryWithOffline(sale, api, {})

		expect(result.error).toMatchObject({ status: 401 })
		expect(handleOfflineQuery).not.toHaveBeenCalled()
	})

	it('saves a sale locally and goes offline on a real network failure', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('Failed to fetch')
			}),
		)

		const result = await baseQueryWithOffline(sale, api, {})

		expect(result).toEqual({ data: 'local' })
		expect(handleOfflineQuery).toHaveBeenCalledOnce()
		expect(getIsNetworkOnline()).toBe(false)
	})
})
