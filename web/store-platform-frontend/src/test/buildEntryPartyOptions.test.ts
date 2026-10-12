import { describe, expect, it } from 'vitest'

import { buildEntryPartyOptions } from '../components/SellingInvoice/utils'

describe('buildEntryPartyOptions', () => {
	it('lists partners, then the first party type, then the second', () => {
		expect(
			buildEntryPartyOptions(
				[
					{ partnerId: 'p1', name: 'Partner' },
					{ internalCode: 'p-code' },
					{ name: 'No id' },
				],
				[{ id: 's1', name: 'Supplier' }],
				[{ id: 'c1', name: 'Customer' }],
			),
		).toEqual([
			{ value: 'p1', label: 'Partner' },
			{ value: 'p-code', label: 'p-code' },
			{ value: 's1', label: 'Supplier' },
			{ value: 'c1', label: 'Customer' },
		])
	})
})
