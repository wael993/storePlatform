// import rateLimit from 'express-rate-limit'
// import RedisStore from 'rate-limit-redis'
// import Redis from 'ioredis'
// import { config } from '../config/config'
// import { Request, Response } from 'express'

// // const redisClient = new Redis({
// // 	host: config.redis.host,
// // 	port: config.redis.port,
// // 	password: config.redis.password,
// // 	enableOfflineQueue: false,
// // 	maxRetriesPerRequest: 1,
// // })

// // redisClient.on('error', (err) => {
// // 	console.error('Redis rate-limiter connection error:', err.message)
// // })

// const createRedisStore = (prefix: string) =>
// 	new RedisStore({
// 		// @ts-expect-error - ioredis is compatible but types differ
// 		sendCommand: (...args: string[]) => redisClient.call(...args),
// 		prefix: `rl:${prefix}:`,
// 	})

// export const loginRateLimiter = rateLimit({
// 	windowMs: 60 * 1000, // 1 minute
// 	max: 5,
// 	standardHeaders: true,
// 	legacyHeaders: false,
// 	store: createRedisStore('login'),
// 	keyGenerator: (req: Request) => {
// 		return req.ip || req.socket.remoteAddress || 'unknown'
// 	},
// 	handler: (_req: Request, res: Response) => {
// 		res.status(429).json({
// 			errorCode: 'TOO_MANY_REQUESTS',
// 			message: 'Too many login attempts. Please try again after 1 minute.',
// 		})
// 	},
// })

// export const refreshRateLimiter = rateLimit({
// 	windowMs: 60 * 1000,
// 	max: 5,
// 	standardHeaders: true,
// 	legacyHeaders: false,
// 	store: createRedisStore('refresh'),
// 	keyGenerator: (req: Request) => {
// 		return req.ip || req.socket.remoteAddress || 'unknown'
// 	},
// 	handler: (_req: Request, res: Response) => {
// 		res.status(429).json({
// 			errorCode: 'TOO_MANY_REQUESTS',
// 			message: 'Too many refresh attempts. Please try again after 1 minute.',
// 		})
// 	},
// })

// export { redisClient }
