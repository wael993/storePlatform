import { createClient, RedisClientType } from 'redis'

import { config } from '../../config/config'
import logger from '../logger/logger'

class RedisCache {
	private client: RedisClientType | null = null
	private connecting = false
	private stats = {
		hits: 0,
		misses: 0,
		sets: 0,
		dels: 0,
		errors: 0,
	}

	private ensureClient(): RedisClientType {
		if (this.client) {
			return this.client
		}

		this.client = createClient({
			username: config.redis.username,
			password: config.redis.password,
			socket: {
				host: config.redis.host,
				port: config.redis.port,
			},
		})

		this.client.on('error', err => {
			logger.error(`Redis Client Error: ${err.message}`)
		})

		return this.client
	}

	public async connect(): Promise<void> {
		logger.info('Connecting to Redis cache...')
		if (this.connecting) {
			logger.info('Already connecting to Redis cache')

			return
		}

		if (!config.redis.enabled) {
			logger.info(
				'Redis cache disabled (set REDIS_ENABLED=true and REDIS_HOST/REDIS_PASSWORD)',
			)

			return
		}

		if (!config.redis.host) {
			logger.warn('Redis cache disabled (REDIS_HOST is missing)')

			return
		}

		const redisClient = this.ensureClient()

		if (redisClient.isOpen) {
			logger.info('Redis cache already connected')

			return
		}

		this.connecting = true
		try {
			await redisClient.connect()
			logger.info('Redis cache connected')
		} catch (error: any) {
			logger.warn(`Redis cache disabled (connection failed): ${error.message}`)
		} finally {
			this.connecting = false
		}
	}

	public async disconnect(): Promise<void> {
		if (!this.client || !this.client.isOpen) {
			return
		}

		await this.client.quit()
	}

	private isReady(): boolean {
		return Boolean(config.redis.enabled && this.client?.isOpen)
	}

	private async getJson<T>(key: string): Promise<T | null> {
		if (!this.isReady() || !this.client) {
			return null
		}

		try {
			const value = await this.client.get(key)

			if (!value) {
				this.stats.misses += 1
				logger.debug(`Cache MISS key=${key}`)

				return null
			}

			this.stats.hits += 1
			logger.debug(`Cache HIT key=${key}`)

			return JSON.parse(value) as T
		} catch (error: any) {
			this.stats.errors += 1
			logger.warn(`Redis get failed for key ${key}: ${error.message}`)

			return null
		}
	}

	private async setJson(
		key: string,
		value: unknown,
		ttlSeconds = config.redis.defaultTTLSeconds,
	): Promise<void> {
		if (!this.isReady() || !this.client) {
			return
		}

		try {
			await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds })
			this.stats.sets += 1
			logger.debug(`Cache SET key=${key} ttl=${ttlSeconds}`)
		} catch (error: any) {
			this.stats.errors += 1
			logger.warn(`Redis set failed for key ${key}: ${error.message}`)
		}
	}

	private generationKey(tenantId: string): string {
		return `cache:gen:${tenantId}`
	}

	/**
	 * Read-aside for tenant master lists. The key carries the tenant generation read
	 * before `load`, so a load that started before `invalidate` writes a key nobody reads.
	 */
	public async readThrough<T>(
		key: string,
		tenantId: string,
		load: () => Promise<T>,
	): Promise<T> {
		if (!this.isReady() || !this.client) {
			return load()
		}

		let generation: string

		try {
			generation = (await this.client.get(this.generationKey(tenantId))) ?? '0'
		} catch (error: any) {
			this.stats.errors += 1
			logger.warn(`Redis generation read failed: ${error.message}`)

			return load()
		}

		const generationKey = `${key}:g${generation}`
		const cached = await this.getJson<T>(generationKey)

		if (cached !== null) {
			return cached
		}

		const value = await load()

		await this.setJson(generationKey, value)

		return value
	}

	/** Drops every cached list of the tenant. Call after the write commits. */
	public async invalidate(tenantId: string): Promise<void> {
		if (!this.isReady() || !this.client) {
			return
		}

		try {
			await this.client.incr(this.generationKey(tenantId))
			this.stats.dels += 1
		} catch (error: any) {
			this.stats.errors += 1
			logger.warn(
				`Redis invalidate failed for tenant ${tenantId}: ${error.message}`,
			)
		}
	}

	// Key builders for different entities
	public buildProductListKey(tenantId: string): string {
		// v3: product master only — no inventory / warehouseName / shelfName
		return `cache:products:list:${tenantId}:v3`
	}
	public buildCategoryListKey(tenantId: string): string {
		return `cache:categories:list:${tenantId}`
	}

	public buildProjectListKey(tenantId: string): string {
		return `cache:projects:list:${tenantId}:v2`
	}

	public buildCurrencyListKey(tenantId: string): string {
		return `cache:currencies:list:${tenantId}`
	}

	public buildUnitListKey(tenantId: string): string {
		return `cache:units:list:${tenantId}`
	}

	public buildBrandListKey(tenantId: string): string {
		return `cache:brands:list:${tenantId}`
	}

	public buildShelfListKey(tenantId: string): string {
		return `cache:shelves:list:${tenantId}`
	}

	public buildWarehouseListKey(tenantId: string): string {
		return `cache:warehouses:list:${tenantId}`
	}

	public getStats() {
		return {
			...this.stats,
			ready: this.isReady(),
		}
	}
}

export const redisCache = new RedisCache()
