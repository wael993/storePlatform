import { EventEmitter } from 'events'
import { describe, expect, it, vi } from 'vitest'

import logger from '../shared/logger/logger'
import { requestLogger } from '../middleware/middleware'

const run = (statusCode: number, user?: object) => {
	const log = vi.spyOn(logger, 'log').mockReturnValue(logger)
	const response = Object.assign(new EventEmitter(), {
		statusCode,
		writableFinished: true,
		setHeader: vi.fn(),
	})
	const request = {
		method: 'GET',
		path: '/api/data/customers',
		originalUrl: '/api/data/customers?q=secret',
		headers: { 'x-request-id': 'abcdef1234567890' },
		...user,
	}

	requestLogger(request as any, response as any, vi.fn())
	response.emit('close')
	const [level, line] = log.mock.calls[0]

	log.mockRestore()

	return { level, line }
}

describe('requestLogger', () => {
	it('writes one readable line with tenant and user, without the query string', () => {
		const { level, line } = run(200, {
			user: { userId: '47d4499c-de6c-4ab5' },
			tenantName: 'Acme Store',
			role: 'admin',
		})

		expect(level).toBe('info')
		expect(line).toMatch(
			/^GET \/api\/data\/customers 200 \d+ms tenant="Acme Store" user=47d4499c role=admin$/,
		)
	})

	it('warns on 4xx with the request id, errors on 5xx', () => {
		expect(run(401)).toMatchObject({ level: 'warn' })
		expect(run(401).line).toMatch(/ req=abcdef12$/)
		expect(run(500).level).toBe('error')
	})
})
