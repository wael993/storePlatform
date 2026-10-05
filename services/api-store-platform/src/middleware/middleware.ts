import express from 'express'
import { randomUUID } from 'crypto'
import logger, { EntityType } from '../shared/logger/logger'
import { AsyncLocalStorage } from 'async_hooks'

export interface RequestStore {
	requestId: string
	method?: string
	path?: string
	errorLogged?: boolean
}
const storage = new AsyncLocalStorage<RequestStore>()

export const runWithRequestStore = <T>(store: RequestStore, fn: () => T): T =>
	storage.run(store, fn)

const SKIPPED_PATHS = new Set(['/livez', '/readyz', '/status'])

const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,128}$/

const levelFor = (statusCode: number) => (statusCode >= 400 ? 'error' : 'info')

export const requestLogger = (
	request: express.Request & { user?: { userId?: string } },
	response: express.Response,
	next: express.NextFunction,
) => {
	const start = process.hrtime.bigint()

	const inbound = request.headers['x-request-id']
	const requestId =
		typeof inbound === 'string' && SAFE_REQUEST_ID.test(inbound)
			? inbound
			: randomUUID()

	response.setHeader('x-request-id', requestId)

	const store: RequestStore = {
		requestId,
		method: request.method,
		path: request.path,
	}

	response.on('close', () => {
		const aborted = !response.writableFinished

		if (
			SKIPPED_PATHS.has(request.path) &&
			response.statusCode < 400 &&
			!aborted
		)
			return

		const durationMs = Number(process.hrtime.bigint() - start) / 1e6

		const level = store.errorLogged
			? 'info'
			: aborted
				? 'warn'
				: levelFor(response.statusCode)

		logger.log(level, 'Request completed', {
			entity: EntityType.API,
			method: request.method,
			route: request.route?.path ?? 'unmatched',
			path: request.route ? undefined : request.path,
			statusCode: response.statusCode,
			aborted: aborted || undefined,
			durationMs: Math.round(durationMs * 10) / 10,
			bytes: Number(response.getHeader('content-length')) || undefined,
			requestId,
			userId: request.user?.userId,
		})
	})

	runWithRequestStore(store, next)
}
