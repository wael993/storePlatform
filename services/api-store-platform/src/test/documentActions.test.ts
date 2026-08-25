import { describe, expect, it } from 'vitest'

import { omitIdentityFields } from '../shared/mongodb/documentActions'

describe('omitIdentityFields', () => {
	it('drops tenant and audit fields from an update payload', () => {
		expect(
			omitIdentityFields({
				tenantId: 'other-tenant',
				createdBy: 'attacker',
				updatedBy: 'attacker',
				name: 'kept',
			}),
		).toEqual({ name: 'kept' })
	})
})
