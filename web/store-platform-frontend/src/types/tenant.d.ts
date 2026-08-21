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
	canRequestRenewal?: boolean
}

interface RenewalRequestActor {
	userId: string
	displayName: string
}

interface RenewalRequestView {
	requestId: string
	tenantId: string
	tenantName: string
	requestedBy: RenewalRequestActor
	currentExpirationDate: string
	status: 'pending' | 'approved' | 'rejected' | 'cancelled'
	requestedAt: string
	reviewedAt: string | null
	reviewedBy: RenewalRequestActor | null
	rejectionReason: string | null
	tenantStatus?: string | null
	subscription?: TenantSubscriptionView | null
}

interface SubscriptionPaymentMethod {
	id: string
	name: string
	details: string
	qrUrl: string
}

interface SubscriptionPaymentSettings {
	contactName: string
	contactEmail: string
	contactPhone: string
	methods: SubscriptionPaymentMethod[]
}

interface SubscriptionResponse {
	subscription: TenantSubscriptionView | null
	pendingRequest: RenewalRequestView | null
	latestRequest: RenewalRequestView | null
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
