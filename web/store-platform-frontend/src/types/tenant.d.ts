interface TenantSummary {
	tenantId: string
	name: string
	domain: string
	status: 'active' | 'inactive'
	accessiblePages: string[]
	offlineEnabled: boolean
	invoiceAiMonthlyLimit?: number | null
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
	offlineEnabled?: boolean
	invoiceAiMonthlyLimit?: number
}

interface InvoiceAiUsage {
	available: number
	monthlyLimit: number
	nextPeriodStartsAt: string
}
