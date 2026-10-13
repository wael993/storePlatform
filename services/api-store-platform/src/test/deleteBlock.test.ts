import { describe, expect, it } from 'vitest'

import { stampDeleteAvailability } from '../shared/deleteBlock'

describe('stampDeleteAvailability', () => {
	it('marks only the blocked id and leaves the others deletable', () => {
		const blocked = new Map([['a', 'invoice']])
		const rows = stampDeleteAvailability(
			[{ id: 'a' }, { id: 'b' }],
			row => row.id,
			blocked,
		)

		expect(rows[0]).toMatchObject({
			id: 'a',
			isDeletable: false,
			deleteBlockReason: 'invoice',
		})
		expect(rows[1]).toMatchObject({
			id: 'b',
			isDeletable: true,
			deleteBlockReason: null,
		})
	})
})
