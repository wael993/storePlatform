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
			logger.info('Redis cache disabled')
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

	public async getJson<T>(key: string): Promise<T | null> {
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

	public async setJson(
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

	public async del(key: string): Promise<boolean> {
		if (!this.isReady() || !this.client) {
			return false
		}

		try {
			const deleted = await this.client.del(key)
			if (deleted > 0) {
				this.stats.dels += 1
				logger.debug(`Cache key deleted: key=${key}`)
				return true
			}
			return false
		} catch (error: any) {
			this.stats.errors += 1
			logger.warn(`Redis delete failed for key ${key}: ${error.message}`)
			return false
		}
	}

	public async delByPattern(pattern: string): Promise<number> {
		if (!this.isReady() || !this.client) {
			return 0
		}

		try {
			const keys: string[] = []
			for await (const key of this.client.scanIterator({
				MATCH: pattern,
				COUNT: 100,
			})) {
				keys.push(key)
			}

			if (keys.length > 0) {
				const deleted = await this.client.del(keys)
				this.stats.dels += deleted
				logger.debug(
					`Cache pattern deleted: pattern=${pattern} count=${deleted}`,
				)
				return deleted
			}
			return 0
		} catch (error: any) {
			this.stats.errors += 1
			logger.warn(
				`Redis pattern delete failed for ${pattern}: ${error.message}`,
			)
			return 0
		}
	}

	// Key builders for different entities
	public buildProductListKey(tenantId: string): string {
		return `cache:products:list:${tenantId}`
	}

	public buildProductDetailKey(tenantId: string, productId: string): string {
		return `cache:products:detail:${tenantId}:${productId}`
	}

	public buildOrderListKey(tenantId: string): string {
		return `cache:orders:list:${tenantId}`
	}

	public buildOrderDetailKey(tenantId: string, orderId: string): string {
		return `cache:orders:detail:${tenantId}:${orderId}`
	}

	public buildInvoiceListKey(tenantId: string): string {
		return `cache:invoices:list:${tenantId}`
	}

	public buildInvoiceDetailKey(tenantId: string, invoiceId: string): string {
		return `cache:invoices:detail:${tenantId}:${invoiceId}`
	}

	public buildInventoryListKey(tenantId: string): string {
		return `cache:inventory:list:${tenantId}`
	}

	public buildInventoryDetailKey(
		tenantId: string,
		inventoryId: string,
	): string {
		return `cache:inventory:detail:${tenantId}:${inventoryId}`
	}

	public buildEntityDetailPatternKey(
		entity: 'products' | 'orders' | 'invoices' | 'inventory',
		tenantId: string,
	): string {
		return `cache:${entity}:detail:${tenantId}:*`
	}

	public getStats() {
		return {
			...this.stats,
			ready: this.isReady(),
		}
	}
}

export const redisCache = new RedisCache()
