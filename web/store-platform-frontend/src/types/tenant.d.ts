interface TenantSummary {
	tenantId: string
	name: string
	domain: string
	status: 'active' | 'inactive'
	createdAt: string
	updatedAt: string
	permissions: {
		canUpdate: boolean
		canDelete: boolean
		canToggleStatus: boolean
		reason?: string
	}
}

interface UpdateTenantRequest {
	tenantName?: string
	status?: 'active' | 'inactive'
}
