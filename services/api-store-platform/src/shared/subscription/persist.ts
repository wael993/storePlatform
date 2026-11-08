import Tenant, { ITenant } from '../../models/Tenant'
import { pgFindOne, pgFindOneAndUpdate } from '../../db/mongoQuery'
import { config } from '../../config/config'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import { TENANT_STATUS } from '../constants/tenant.constants'
import { isSuperAdminTenant } from '../Permissions'
import {
	calendarDateInTimeZone,
	createSubscription,
	renewSubscription,
	SubscriptionLifecycleConfig,
	SubscriptionView,
	TenantSubscription,
	tickSubscription,
	toSubscriptionView,
} from './lifecycle'

export const getSubscriptionConfig = (): SubscriptionLifecycleConfig => ({
	periodDays: config.subscription.periodDays,
	warningDays: config.subscription.warningDays,
	timeZone: config.cron.timezone,
})

const persistSubscription = async (
	tenantId: string,
	subscription: TenantSubscription,
	deactivateTenant: boolean,
	previousRenewalDate?: Date,
): Promise<ITenant | null> =>
	pgFindOneAndUpdate(
		Tenant,
		tenantId,
		// no renewal date also covers "no subscription" (flat columns)
		{ 'subscription.renewalDate': previousRenewalDate ?? { $exists: false } },
		{
			$set: {
				subscription,
				...(deactivateTenant ? { status: TENANT_STATUS.INACTIVE } : {}),
			},
		},
		{ new: true },
	)

export const syncTenantSubscription = async (
	tenant: ITenant,
	now = new Date(),
): Promise<{ tenant: ITenant; view: SubscriptionView | null }> => {
	if (isSuperAdminTenant(tenant)) {
		return { tenant, view: null }
	}

	const fresh = (await pgFindOne<ITenant>(Tenant, tenant.tenantId)) ?? tenant

	if (isSuperAdminTenant(fresh)) {
		return { tenant: fresh, view: null }
	}

	const cfg = getSubscriptionConfig()
	const created =
		!fresh.subscription?.renewalDate || !fresh.subscription?.startDate
	const subscription =
		fresh.subscription?.renewalDate && fresh.subscription?.startDate
			? fresh.subscription
			: createSubscription(fresh.createdAt ?? now, now, cfg)
	const tick = tickSubscription(subscription, now, cfg)
	const shouldDeactivate =
		tick.deactivateTenant && fresh.status === TENANT_STATUS.ACTIVE

	if (!created && !tick.changed && !shouldDeactivate) {
		return { tenant: fresh, view: tick.view }
	}

	const updated = await persistSubscription(
		fresh.tenantId,
		tick.subscription,
		shouldDeactivate,
		created ? undefined : fresh.subscription?.renewalDate,
	)

	return {
		tenant: updated ?? fresh,
		view: tick.view,
	}
}

export const tenantMaySignIn = (tenant: ITenant, now = new Date()): boolean => {
	if (tenant.status === TENANT_STATUS.ACTIVE) {
		return true
	}

	if (!tenant.subscription) {
		return false
	}

	return toView(tenant.subscription, now).expired
}

export const applySubscriptionRenewal = async (
	tenant: ITenant,
	now = new Date(),
	expectedRenewalDate?: Date,
): Promise<{ tenant: ITenant; view: SubscriptionView }> => {
	const synced = await syncTenantSubscription(tenant, now)
	const current = synced.tenant.subscription

	if (!current) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'Tenant subscription not found.',
		)
	}

	const cfg = getSubscriptionConfig()
	const currentYmd = calendarDateInTimeZone(current.renewalDate, cfg.timeZone)

	if (expectedRenewalDate) {
		const expectedYmd = calendarDateInTimeZone(
			expectedRenewalDate,
			cfg.timeZone,
		)

		if (currentYmd > expectedYmd) {
			return { tenant: synced.tenant, view: toView(current, now) }
		}

		if (currentYmd !== expectedYmd) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Tenant subscription not found.',
			)
		}
	}

	const renewed = renewSubscription(current, now, cfg)
	const updated = (await pgFindOneAndUpdate(
		Tenant,
		tenant.tenantId,
		{ 'subscription.renewalDate': current.renewalDate },
		{
			$set: {
				subscription: renewed,
				status: TENANT_STATUS.ACTIVE,
			},
		},
		{ new: true },
	)) as ITenant | null

	if (!updated?.subscription) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'Tenant subscription not found.',
		)
	}

	return {
		tenant: updated,
		view: toView(updated.subscription, now),
	}
}

export const toView = (
	subscription: TenantSubscription,
	now = new Date(),
): SubscriptionView =>
	toSubscriptionView(subscription, now, getSubscriptionConfig())
