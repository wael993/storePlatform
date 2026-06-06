export const TENANT_STATUS = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
} as const

export type TenantStatus = (typeof TENANT_STATUS)[keyof typeof TENANT_STATUS]
