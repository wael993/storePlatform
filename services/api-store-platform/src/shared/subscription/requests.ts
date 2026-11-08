import { v4 as uuidv4 } from 'uuid'
import { ALL_TENANTS, isUniqueViolation } from '../../db'
import { insertDoc } from '../../db/docs'
import { pgFind, pgFindOne, pgFindOneAndUpdate } from '../../db/mongoQuery'
import Tenant, { ITenant } from '../../models/Tenant'
import SubscriptionRenewalRequest, {
	ISubscriptionRenewalRequest,
	RENEWAL_REQUEST_STATUS,
	RenewalRequestActor,
	RenewalRequestStatus,
} from '../../models/SubscriptionRenewalRequest'
import SubscriptionPaymentSettings, {
	ISubscriptionPaymentSettings,
	SUBSCRIPTION_PAYMENT_SETTINGS_ID,
	SubscriptionPaymentMethod,
} from '../../models/SubscriptionPaymentSettings'
import {
	AuthorizationError,
	BusinessLogicError,
} from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import { RequestContext } from '../types'
import { isSuperAdminTenant } from '../Permissions'
import {
	applySubscriptionRenewal,
	getSubscriptionConfig,
	syncTenantSubscription,
	toView,
} from './persist'
import { calendarDateInTimeZone, SubscriptionView } from './lifecycle'

const actorOf = (requestContext: RequestContext): RenewalRequestActor => {
	const userId = requestContext.userId || requestContext.user?.userId || ''
	const displayName = [
		requestContext.user?.firstName,
		requestContext.user?.lastName,
	]
		.filter(Boolean)
		.join(' ')

	return {
		userId,
		displayName: displayName || requestContext.user?.email || userId,
	}
}

export type RenewalRequestView = {
	requestId: string
	tenantId: string
	tenantName: string
	requestedBy: RenewalRequestActor
	currentExpirationDate: string
	status: RenewalRequestStatus
	requestedAt: string
	reviewedAt: string | null
	reviewedBy: RenewalRequestActor | null
	rejectionReason: string | null
}

const ymdOf = (date: Date): string =>
	calendarDateInTimeZone(date, getSubscriptionConfig().timeZone)

export const toRenewalRequestView = (
	request: ISubscriptionRenewalRequest,
): RenewalRequestView => ({
	requestId: request.requestId,
	tenantId: request.tenantId,
	tenantName: request.tenantName,
	requestedBy: request.requestedBy,
	currentExpirationDate: ymdOf(request.currentExpirationDate),
	status: request.status,
	requestedAt: request.requestedAt.toISOString(),
	reviewedAt: request.reviewedAt ? request.reviewedAt.toISOString() : null,
	reviewedBy: request.reviewedBy,
	rejectionReason: request.rejectionReason,
})

export const getPendingRequest = async (tenantId: string) =>
	pgFindOne<ISubscriptionRenewalRequest>(SubscriptionRenewalRequest, tenantId, {
		status: RENEWAL_REQUEST_STATUS.PENDING,
	})

export const getLatestRequest = async (tenantId: string) =>
	pgFindOne<ISubscriptionRenewalRequest>(
		SubscriptionRenewalRequest,
		tenantId,
		{},
		{ sort: { requestedAt: -1 } },
	)

export type SuperadminRenewalRequestView = RenewalRequestView & {
	tenantStatus: string | null
	subscription: SubscriptionView | null
}

export const listAllRenewalRequests = async (): Promise<
	SuperadminRenewalRequestView[]
> => {
	const requests = await pgFind<ISubscriptionRenewalRequest>(
		SubscriptionRenewalRequest,
		ALL_TENANTS,
		{},
		{ sort: { requestedAt: -1 } },
	)
	const tenantIds = [...new Set(requests.map(request => request.tenantId))]
	const tenants = tenantIds.length
		? await pgFind<ITenant>(Tenant, ALL_TENANTS, {
				tenantId: { $in: tenantIds },
			})
		: []
	const tenantsById = new Map(
		tenants.map(tenant => [tenant.tenantId, tenant] as const),
	)

	return requests.map(request => {
		const tenant = tenantsById.get(request.tenantId)

		return {
			...toRenewalRequestView(request),
			tenantStatus: tenant?.status ?? null,
			subscription: tenant?.subscription ? toView(tenant.subscription) : null,
		}
	})
}

export const createRenewalRequest = async (
	tenant: ITenant,
	requestContext: RequestContext,
	now = new Date(),
) => {
	const { tenant: synced, view } = await syncTenantSubscription(tenant, now)

	const subscription = synced.subscription

	if (isSuperAdminTenant(synced) || !subscription || !view) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_CREATE_ERROR,
			'Tenant subscription not found.',
		)
	}

	if (!view.warning && !view.expired) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			'Renewal can only be requested in the final 30 days or after expiry.',
		)
	}

	const pending = await getPendingRequest(synced.tenantId)

	if (pending) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			'A renewal request is already pending.',
		)
	}

	try {
		const created = await insertDoc(SubscriptionRenewalRequest, {
			requestId: uuidv4(),
			tenantId: synced.tenantId,
			tenantName: synced.name,
			requestedBy: actorOf(requestContext),
			currentExpirationDate: subscription.renewalDate,
			status: RENEWAL_REQUEST_STATUS.PENDING,
			requestedAt: now,
		})

		return toRenewalRequestView(
			created as unknown as ISubscriptionRenewalRequest,
		)
	} catch (error: unknown) {
		// partial unique index: one pending request per tenant
		if (isUniqueViolation(error)) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'A renewal request is already pending.',
			)
		}

		throw error
	}
}

export const approveRenewalRequest = async (
	requestId: string,
	requestContext: RequestContext,
	now = new Date(),
) => {
	const reviewedBy = actorOf(requestContext)
	const claimed = (await pgFindOneAndUpdate(
		SubscriptionRenewalRequest,
		ALL_TENANTS,
		{ requestId, status: RENEWAL_REQUEST_STATUS.PENDING },
		{
			$set: {
				status: RENEWAL_REQUEST_STATUS.APPROVED,
				reviewedAt: now,
				reviewedBy,
				rejectionReason: null,
			},
		},
		{ new: true },
	)) as ISubscriptionRenewalRequest | null

	if (!claimed) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'Pending renewal request not found.',
		)
	}

	const revertClaim = () =>
		pgFindOneAndUpdate(
			SubscriptionRenewalRequest,
			ALL_TENANTS,
			{ requestId, status: RENEWAL_REQUEST_STATUS.APPROVED },
			{
				$set: {
					status: RENEWAL_REQUEST_STATUS.PENDING,
					reviewedAt: null,
					rejectionReason: null,
				},
				$unset: { 'reviewedBy.userId': 1, 'reviewedBy.displayName': 1 },
			},
		)

	const tenant = await pgFindOne<ITenant>(Tenant, claimed.tenantId)

	if (!tenant) {
		await revertClaim()

		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'Tenant not found.',
		)
	}

	try {
		await applySubscriptionRenewal(tenant, now, claimed.currentExpirationDate)
	} catch (error) {
		await revertClaim()

		throw error
	}

	return toRenewalRequestView(claimed)
}

export const rejectRenewalRequest = async (
	requestId: string,
	reason: string,
	requestContext: RequestContext,
	now = new Date(),
) => {
	const rejectionReason = reason.trim()
	const updated = (await pgFindOneAndUpdate(
		SubscriptionRenewalRequest,
		ALL_TENANTS,
		{ requestId, status: RENEWAL_REQUEST_STATUS.PENDING },
		{
			$set: {
				status: RENEWAL_REQUEST_STATUS.REJECTED,
				reviewedAt: now,
				reviewedBy: actorOf(requestContext),
				rejectionReason: rejectionReason || null,
			},
		},
		{ new: true },
	)) as ISubscriptionRenewalRequest | null

	if (!updated) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'Pending renewal request not found.',
		)
	}

	return toRenewalRequestView(updated)
}

export type PaymentSettingsView = {
	contactName: string
	contactEmail: string
	contactPhone: string
	methods: SubscriptionPaymentMethod[]
}

const emptyPaymentSettings = (): PaymentSettingsView => ({
	contactName: '',
	contactEmail: '',
	contactPhone: '',
	methods: [],
})

const ALLOWED_QR_URL = /^(https?:\/\/|data:image\/)/i

export const sanitizePaymentQrUrl = (value: string): string => {
	const qrUrl = value.trim().slice(0, 2000)

	return ALLOWED_QR_URL.test(qrUrl) ? qrUrl : ''
}

const toPaymentSettingsView = (
	settings: ISubscriptionPaymentSettings | null,
): PaymentSettingsView => {
	if (!settings) {
		return emptyPaymentSettings()
	}

	return {
		contactName: settings.contactName,
		contactEmail: settings.contactEmail,
		contactPhone: settings.contactPhone,
		methods: settings.methods.map(method => ({
			id: method.id,
			name: method.name,
			details: method.details,
			qrUrl: sanitizePaymentQrUrl(method.qrUrl),
		})),
	}
}

export const getPaymentSettings = async (): Promise<PaymentSettingsView> => {
	const settings = await pgFindOne<ISubscriptionPaymentSettings>(
		SubscriptionPaymentSettings,
		ALL_TENANTS,
		{ settingsId: SUBSCRIPTION_PAYMENT_SETTINGS_ID },
	)

	return toPaymentSettingsView(settings)
}

const sanitizeMethods = (value: unknown): SubscriptionPaymentMethod[] => {
	if (!Array.isArray(value)) {
		return []
	}

	return value.slice(0, 10).flatMap(item => {
		if (!item || typeof item !== 'object') {
			return []
		}

		const method = item as Partial<SubscriptionPaymentMethod>
		const name = typeof method.name === 'string' ? method.name.trim() : ''

		if (!name) {
			return []
		}

		return [
			{
				id:
					typeof method.id === 'string' && method.id.trim()
						? method.id.trim()
						: uuidv4(),
				name: name.slice(0, 80),
				details:
					typeof method.details === 'string'
						? method.details.trim().slice(0, 500)
						: '',
				qrUrl:
					typeof method.qrUrl === 'string'
						? sanitizePaymentQrUrl(method.qrUrl)
						: '',
			},
		]
	})
}

export const savePaymentSettings = async (
	body: Partial<PaymentSettingsView>,
): Promise<PaymentSettingsView> => {
	const updated = (await pgFindOneAndUpdate(
		SubscriptionPaymentSettings,
		ALL_TENANTS,
		{ settingsId: SUBSCRIPTION_PAYMENT_SETTINGS_ID },
		{
			$set: {
				contactName:
					typeof body.contactName === 'string'
						? body.contactName.trim().slice(0, 100)
						: '',
				contactEmail:
					typeof body.contactEmail === 'string'
						? body.contactEmail.trim().slice(0, 120)
						: '',
				contactPhone:
					typeof body.contactPhone === 'string'
						? body.contactPhone.trim().slice(0, 40)
						: '',
				methods: sanitizeMethods(body.methods),
			},
			$setOnInsert: { settingsId: SUBSCRIPTION_PAYMENT_SETTINGS_ID },
		},
		{ new: true, upsert: true },
	)) as ISubscriptionPaymentSettings | null

	return toPaymentSettingsView(updated)
}

export const assertCanRequestRenewal = (requestContext: RequestContext) => {
	const { role } = requestContext

	if (role !== 'owner' && role !== 'admin') {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Only owner or admin can request a subscription renewal.',
		)
	}
}
