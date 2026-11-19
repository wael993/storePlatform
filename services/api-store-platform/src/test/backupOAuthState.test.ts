import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'

import ProductController from '../apis/api.controller'
import { config } from '../config/config'

describe('backup OAuth state token', () => {
	it('is refused as a login token (it carries no userId)', async () => {
		const state = jwt.sign(
			{ tenantId: 't1', provider: 'google_drive', nonce: 'n' },
			config.jwtSecret,
			{ audience: 'backup-oauth', expiresIn: '10m' },
		)

		await expect(
			new ProductController({} as never, {} as never).validateUser({}, state),
		).rejects.toThrow('Invalid token.')
	})
})
