import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { config } from '../config/config'
import { redisCache } from '../shared/cache/redisCache'

// in-memory stand-in for the node-redis calls readThrough / invalidate use
const fakeClient = () => {
	const store = new Map<string, string>()

	return {
		isOpen: true,
		store,
		get: async (key: string) => store.get(key) ?? null,
		set: async (key: string, value: string) => {
			store.set(key, value)
		},
		incr: async (key: string) => {
			const next = Number(store.get(key) ?? '0') + 1

			store.set(key, String(next))

			return next
		},
	}
}

describe('redisCache generation', () => {
	const cache = redisCache as unknown as { client: unknown }
	const enabled = config.redis.enabled

	beforeEach(() => {
		config.redis.enabled = true
		cache.client = fakeClient()
	})

	afterEach(() => {
		config.redis.enabled = enabled
		cache.client = null
	})

	it('serves a hit without loading again', async () => {
		await redisCache.readThrough('k', 't1', async () => ['a'])

		const loaded = await redisCache.readThrough('k', 't1', async () => ['b'])

		expect(loaded).toEqual(['a'])
	})

	it('a load that started before invalidate is not served after it', async () => {
		let release: () => void = () => undefined
		const gate = new Promise<void>(resolve => {
			release = resolve
		})

		// slow read: loads the pre-save list, finishes after the save
		const slowRead = redisCache.readThrough('k', 't1', async () => {
			await gate

			return ['old price']
		})

		await new Promise(resolve => setTimeout(resolve, 0))
		await redisCache.invalidate('t1')
		release()
		await slowRead

		const next = await redisCache.readThrough('k', 't1', async () => [
			'new price',
		])

		expect(next).toEqual(['new price'])
	})

	// real keys always contain the tenant id
	it('invalidate only drops the given tenant', async () => {
		await redisCache.readThrough('k:t1', 't1', async () => ['t1'])
		await redisCache.readThrough('k:t2', 't2', async () => ['t2'])
		await redisCache.invalidate('t1')

		expect(
			await redisCache.readThrough('k:t2', 't2', async () => ['x']),
		).toEqual(['t2'])

		expect(
			await redisCache.readThrough('k:t1', 't1', async () => ['y']),
		).toEqual(['y'])
	})

	it('loads directly when Redis is off', async () => {
		config.redis.enabled = false

		expect(await redisCache.readThrough('k', 't1', async () => ['db'])).toEqual(
			['db'],
		)
	})
})
