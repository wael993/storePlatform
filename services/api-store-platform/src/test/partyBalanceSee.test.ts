import { describe, expect, it } from 'vitest'

import { omitReceivableIfHidden } from '../apis/customer/api.controller'
import { omitPayableIfHidden } from '../apis/supplier/api.controller'
import type { RequestContext } from '../shared/types'
import type { CustomerResponse, SuppliersResponse } from '../shared/types/api'

const context = (see: string[]) => ({ see }) as unknown as RequestContext

describe('party balance SEE', () => {
	const customer = {
		customerId: 'c1',
		name: 'Ali',
		totalReceivable: 120,
		openingBalances: [
			{ currencyId: 'syp', amount: 500, direction: 'owed_to_us' },
		],
	} as unknown as CustomerResponse
	const supplier = {
		supplierId: 's1',
		name: 'Acme',
		totalPayable: 80,
		openingBalances: [
			{ currencyId: 'syp', amount: 500, direction: 'owed_to_us' },
		],
	} as unknown as SuppliersResponse['data'][number]

	it('drops totalReceivable and opening balance without customers.totalReceivable', () => {
		const row = omitReceivableIfHidden(customer, context([]))

		expect(row).not.toHaveProperty('totalReceivable')
		expect(row).not.toHaveProperty('openingBalances')
		expect(row).toMatchObject({ customerId: 'c1', name: 'Ali' })
		expect(customer.totalReceivable).toBe(120)
	})

	it('keeps totalReceivable with customers.totalReceivable', () => {
		expect(
			omitReceivableIfHidden(customer, context(['customers.totalReceivable']))
				.totalReceivable,
		).toBe(120)
	})

	it('drops totalPayable and opening balance without suppliers.totalPayable', () => {
		const row = omitPayableIfHidden(supplier, context([]))

		expect(row).not.toHaveProperty('totalPayable')
		expect(row).not.toHaveProperty('openingBalances')
		expect(row).toMatchObject({ supplierId: 's1', name: 'Acme' })
	})

	it('keeps totalPayable with suppliers.totalPayable', () => {
		expect(
			omitPayableIfHidden(supplier, context(['suppliers.totalPayable']))
				.totalPayable,
		).toBe(80)
	})
})
