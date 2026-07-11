interface TenantSummary {
	tenantId: string
	name: string
	domain: string
	status: 'active' | 'inactive'
	accessiblePages: string[]
	offlineEnabled: boolean
	createdAt: string
	updatedAt: string
	permissions: {
		canChangeTenantSettings: boolean
		canUpdate: boolean
		canDelete: boolean
		canToggleStatus: boolean
		reason?: string
	}
}

interface UpdateTenantRequest {
	tenantName?: string
	status?: 'active' | 'inactive'
	accessiblePages?: string[]
}
