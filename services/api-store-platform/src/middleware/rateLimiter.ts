import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { Request, Response } from 'express'
import { ERROR_CODES } from '../shared/errorCodes'

// note: in-memory store is per-process. Use Redis store if login runs on multiple instances.
export const loginRateLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 5,
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req: Request) =>
		ipKeyGenerator(req.ip || req.socket.remoteAddress || '127.0.0.1'),
	handler: (_req: Request, res: Response) => {
		res.status(429).json({
			errorCode: ERROR_CODES.AUTHORIZATION.TOO_MANY_REQUESTS,
			message: 'Too many login attempts. Please try again after 1 minute.',
		})
	},
})
