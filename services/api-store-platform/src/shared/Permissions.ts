import { getSuperAdminTenantId } from './tenant'

type TenantLike = {
	tenantId: string
	name?: string
	domain?: string
}

export type TenantPermissions = {
	canChangeTenantSettings: boolean
	canUpdate: boolean
	canDelete: boolean
	canToggleStatus: boolean
	reason?: string
}

export const isSuperAdminTenant = (tenant: TenantLike): boolean =>
	tenant.tenantId === getSuperAdminTenantId()

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
