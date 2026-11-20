import express from 'express'
import { randomUUID } from 'crypto'
import logger from '../shared/logger/logger'
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

const levelFor = (statusCode: number) =>
	statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'

// short id prefix keeps lines scannable; still greppable against the full id
const shortId = (id?: string) => id?.slice(0, 8)

export const requestLogger = (
	request: express.Request & {
		user?: { userId?: string }
		tenantName?: string
		role?: string
	},
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

		const path = request.originalUrl.split('?')[0]
		const line = [
			`${request.method} ${path}`,
			aborted ? 'aborted' : response.statusCode,
			`${Math.round(durationMs)}ms`,
			request.tenantName && `tenant="${request.tenantName}"`,
			request.user?.userId && `user=${shortId(request.user.userId)}`,
			request.role && `role=${request.role}`,
			// lets a failed request be matched to the x-request-id the client saw
			response.statusCode >= 400 && `req=${shortId(requestId)}`,
		]

		logger.log(level, line.filter(Boolean).join(' '))
	})

	runWithRequestStore(store, next)
}
