import { describe, expect, it } from 'vitest'

import { TENANT_ACCESSIBLE_PAGE } from '../shared/constants/tenantAccessiblePages'
import {
	defaultSeeIds,
	resolveSeeIds,
	sanitizeSeeIdsForSave,
	SEE,
} from '../shared/seeCatalog'

const pages = [
	TENANT_ACCESSIBLE_PAGE.PRODUCTS,
	TENANT_ACCESSIBLE_PAGE.SELLING_INVOICES,
]

describe('seeCatalog', () => {
	it('gives owners every available see id', () => {
		const ids = resolveSeeIds('owner', pages, null)

		expect(ids).toContain(SEE.products)
		expect(ids).toContain(SEE.invoices)
		expect(ids).toContain(SEE.welcome)
	})

	it('uses role defaults plus locked ids for cashiers without stored see', () => {
		const ids = defaultSeeIds('cashier', pages)

		expect(ids).toContain(SEE.welcome)
		expect(ids).toContain(SEE.products)
		expect(ids).toContain(SEE.sellingInvoices)
	})

	it('always keeps locked products when saving', () => {
		expect(sanitizeSeeIdsForSave(pages, 'not-an-array')).toContain(SEE.products)
	})

	it('drops a child see id when its parent is off', () => {
		const saved = sanitizeSeeIdsForSave(pages, [SEE.sellingInvoicesDelete])

		expect(saved).not.toContain(SEE.sellingInvoicesDelete)
		expect(saved).toContain(SEE.products)
	})

	it('cashiers do not see buying price by default', () => {
		const ids = resolveSeeIds('cashier', pages, null)

		expect(ids).toContain(SEE.products)
		expect(ids).not.toContain(SEE.productsBuyingPrice)
	})

	it('employees do not see settings when see permissions are not set', () => {
		const ids = resolveSeeIds(
			'employee',
			[TENANT_ACCESSIBLE_PAGE.SETTINGS],
			null,
		)

		expect(ids).not.toContain(SEE.settings)
	})

	it('owners see buying price when the tenant has products', () => {
		expect(resolveSeeIds('owner', pages, null)).toContain(
			SEE.productsBuyingPrice,
		)
	})

	it('uses stored see for a non-owner when it exists', () => {
		const ids = resolveSeeIds('cashier', pages, [
			SEE.products,
			SEE.productsBuyingPrice,
		])

		expect(ids).toContain(SEE.productsBuyingPrice)
		expect(ids).toContain(SEE.products)
	})
})
