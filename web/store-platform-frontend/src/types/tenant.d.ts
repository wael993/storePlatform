interface TenantSummary {
	tenantId: string
	name: string
	domain: string
	status: 'active' | 'inactive'
	accessiblePages: string[]
	offlineEnabled: boolean
	invoiceAiMonthlyLimit?: number | null
	subscription?: TenantSubscriptionView | null
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

interface TenantSubscriptionView {
	startDate: string
	renewalDate: string
	lastRenewalDate: string | null
	status: 'active' | 'expired'
	renewalEnabled: boolean
	remainingDays: number
	warning: boolean
	urgent: boolean
	expired: boolean
	canRenew?: boolean
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
