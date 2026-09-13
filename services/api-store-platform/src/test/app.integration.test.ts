import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { createApp } from '../app'

describe('HTTP app', () => {
	it('serves GET /test', async () => {
		const response = await request(createApp()).get('/test')

		expect(response.status).toBe(200)
		expect(response.text).toBe('OK')
	})

	it('uses the larger json parsers for extract and product-import parse', async () => {
		const app = createApp()

		expect(
			(await request(app).post('/api/data/buying-invoices/extract')).status,
		).toBe(401)

		expect(
			(await request(app).post('/api/data/product-import/parse')).status,
		).toBe(401)
	})
})
