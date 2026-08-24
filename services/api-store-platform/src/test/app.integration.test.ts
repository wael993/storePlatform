import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { createApp } from '../app'

describe('HTTP app', () => {
	it('serves GET /test', async () => {
		const response = await request(createApp()).get('/test')

		expect(response.status).toBe(200)
		expect(response.text).toBe('OK')
	})
})
