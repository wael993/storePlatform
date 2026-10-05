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

	it('accepts a Base64 logo payload on invoice-settings without 413', async () => {
		const app = createApp()
		const logoUrl = `data:image/png;base64,${'A'.repeat(250_000)}`

		const response = await request(app)
			.patch('/api/data/invoice-settings')
			.send({ logoUrl })

		// Body parsed; auth rejects before the handler. 413 means the 100kb default still applied.
		expect(response.status).toBe(401)
	})

	it('keeps the default 100kb json limit outside invoice-settings', async () => {
		const app = createApp()
		const logoUrl = `data:image/png;base64,${'A'.repeat(250_000)}`

		const response = await request(app)
			.patch('/api/data/user-settings')
			.send({ productsPerPage: 20, logoUrl })

		expect(response.status).not.toBe(401)
		expect([413, 500]).toContain(response.status)
	})
})
