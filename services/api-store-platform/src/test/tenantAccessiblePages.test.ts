import { describe, expect, it } from 'vitest'

import {
	resolveTenantAccessiblePages,
	TENANT_ACCESSIBLE_PAGE,
} from '../shared/constants/tenantAccessiblePages'

describe('resolveTenantAccessiblePages', () => {
	it('soft-enables Dashboard when stored pages omit it', () => {
		const pages = resolveTenantAccessiblePages({
			accessiblePages: [
				TENANT_ACCESSIBLE_PAGE.PRODUCTS,
				TENANT_ACCESSIBLE_PAGE.SETTINGS,
			],
		})

		expect(pages).toContain(TENANT_ACCESSIBLE_PAGE.DASHBOARD)
		expect(pages).toContain(TENANT_ACCESSIBLE_PAGE.PRODUCTS)
	})

	it('keeps Dashboard when already stored', () => {
		const pages = resolveTenantAccessiblePages({
			accessiblePages: [
				TENANT_ACCESSIBLE_PAGE.DASHBOARD,
				TENANT_ACCESSIBLE_PAGE.PRODUCTS,
			],
		})

		expect(
			pages.filter(page => page === TENANT_ACCESSIBLE_PAGE.DASHBOARD),
		).toHaveLength(1)
	})
})
