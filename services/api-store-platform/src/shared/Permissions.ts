import { DEFAULT_TENANT_ID } from './tenant'

type TenantLike = {
	tenantId: string
	name: string
	domain: string
}

export type TenantPermissions = {
	canChangeTenantSettings: boolean
	canUpdate: boolean
	canDelete: boolean
	canToggleStatus: boolean
	reason?: string
}

export const isSuperAdminTenant = (tenant: TenantLike): boolean => {
	return (
		tenant.tenantId === DEFAULT_TENANT_ID ||
		tenant.domain === 'superadmin.de' ||
		tenant.name.toLowerCase().includes('super admin')
	)
}

export const getTenantPermissions = (tenant: TenantLike): TenantPermissions => {
	if (isSuperAdminTenant(tenant)) {
		return {
			canChangeTenantSettings: true,
			canUpdate: false,
			canDelete: false,
			canToggleStatus: false,
			reason: 'Protected tenant',
		}
	}

	return {
		canChangeTenantSettings: true,
		canUpdate: true,
		canDelete: true,
		canToggleStatus: true,
	}
}
