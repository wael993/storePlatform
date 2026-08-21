import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'

import { BusinessLogicError } from '../../middleware/errorHandler'
import { Inventory } from '../../models/Inventory'
import { Invoice } from '../../models/Invoice'
import { Order } from '../../models/Order'
import { Product } from '../../models/Products'
import { Report } from '../../models/Report'
import RefreshToken from '../../models/RefreshToken'
import Tenant, { ITenant } from '../../models/Tenant'
import User, { IUser } from '../../models/User'
import SubscriptionRenewalRequest from '../../models/SubscriptionRenewalRequest'
import { ERROR_CODES } from '../../shared/errorCodes'
import MongodbController from '../../shared/mongodb/mongodbController'
import { withTenantScope } from '../../shared/mongodb/tenantScopedModel'
import { getTenantPermissions } from '../../shared/Permissions'
import {
	DEFAULT_TENANT_ACCESSIBLE_PAGES,
	sanitizeAccessiblePages,
	TENANT_ACCESSIBLE_PAGE,
} from '../../shared/constants/tenantAccessiblePages'
import { DEFAULT_INVOICE_AI_MONTHLY_LIMIT } from '../../shared/constants/invoiceAi'
import {
	newInvoiceAiUsage,
	parseInvoiceAiMonthlyLimit,
	tenantHasInvoiceAi,
} from '../../shared/invoiceAi/usage'
import {
	ensureSuperAdmin,
	ensureTenantAccess,
	getEmailDomain,
	getTenantContext,
	TenantRole,
} from '../../shared/tenant'
import { COLLECTION_NAMES } from '../../shared/general'
import {
	validateEmail,
	validatePasswordStrength,
} from '../../utils/authValidation'
import { mapTenantSummary } from '../mappings/mapper'
import {
	AddTenantRequestBody,
	AddTenantResponse,
	InviteTenantUserRequestBody,
	InviteTenantUserResponse,
	RequestContext,
	TenantSummary,
	TenantUserSummary,
	UpdateTenantRequestBody,
	UpdateTenantUserRequestBody,
} from '../../shared/types'
import { createSubscription } from '../../shared/subscription/lifecycle'
import {
	getSubscriptionConfig,
	syncTenantSubscription,
	toView,
} from '../../shared/subscription/persist'
import {
	approveRenewalRequest,
	assertCanRequestRenewal,
	createRenewalRequest,
	getLatestRequest,
	getPaymentSettings,
	getPendingRequest,
	listAllRenewalRequests,
	rejectRenewalRequest,
	savePaymentSettings,
	toRenewalRequestView,
} from '../../shared/subscription/requests'

type TenantUserLean = {
	readonly _id: { toString(): string } | string
	readonly userId: string
	readonly displayName: string
	readonly email: string
	readonly role: TenantRole
	readonly user: {
		readonly firstName: string
		readonly lastName: string
	}
}

export default class TenantController {
	constructor(private mongoDbClient: MongodbController) {}

	private mapTenantUser(user: TenantUserLean): TenantUserSummary {
		return {
			_id: String(user._id),
			userId: user.userId,
			displayName: user.displayName,
			email: user.email,
			role: user.role,
			firstName: user.user.firstName,
			lastName: user.user.lastName,
		}
	}

	private createTemporaryPassword(): string {
		const randomPart = crypto.randomBytes(10).toString('base64url')
		const digit = String(crypto.randomInt(0, 10))
		const lower = String.fromCharCode(97 + crypto.randomInt(0, 26))

		return `${lower}${randomPart}${digit}`
	}

	private createTenantIdFromDomain(domain: string): string {
		return domain.replace(/\./g, '-').toLowerCase()
	}

	private async requireTenantById(tenantId: string): Promise<ITenant> {
		const tenant = await Tenant.findOne({
			tenantId,
			status: 'active',
		}).lean<ITenant | null>()

		if (!tenant) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Tenant is not active.',
			)
		}

		return tenant
	}

	public async getTenantUsers(
		requestContext: RequestContext,
	): Promise<TenantUserSummary[]> {
		await ensureTenantAccess(requestContext, COLLECTION_NAMES.USERS, 'read')
		const tenantContext = getTenantContext(requestContext)

		const users = await withTenantScope(
			User.find({}, { password: 0, tokenVersion: 0 }).sort({ createdAt: -1 }),
			tenantContext.tenantId,
		).lean<TenantUserLean[]>()

		return users.map(user => this.mapTenantUser(user))
	}

	public async inviteTenantUser(
		requestBody: InviteTenantUserRequestBody,
		requestContext: RequestContext,
	): Promise<InviteTenantUserResponse> {
		await ensureTenantAccess(requestContext, COLLECTION_NAMES.USERS, 'create')
		const tenantContext = getTenantContext(requestContext)

		const { firstName, lastName, email, role } = requestBody

		if (!firstName || !lastName || !email || !role) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'firstName, lastName, email and role are required.',
			)
		}

		const emailError = validateEmail(email)

		if (emailError) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.INVALID_EMAIL_FORMAT,
				emailError,
			)
		}

		if (role === 'super_admin') {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'super_admin role can only be created from super-admin controls.',
			)
		}

		const tenant = await this.requireTenantById(tenantContext.tenantId)

		if (getEmailDomain(email) !== tenant.domain) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				`User email domain must match tenant domain ${tenant.domain}.`,
			)
		}

		const existing = await withTenantScope(
			User.findOne({ email: email.toLowerCase() }),
			tenantContext.tenantId,
		).lean<IUser | null>()

		if (existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'User already exists in this tenant.',
			)
		}

		const temporaryPassword = this.createTemporaryPassword()
		const hashedPassword = await bcrypt.hash(temporaryPassword, 10)

		const created = await User.create({
			tenantId: tenantContext.tenantId,
			userId: uuidv4(),
			displayName: `${firstName} ${lastName}`,
			user: {
				firstName,
				lastName,
			},
			email: email.toLowerCase(),
			password: hashedPassword,
			role,
			avatarColorId: Math.floor(Math.random() * 1000000),
		})

		return {
			_id: created.id,
			email: created.email,
			tenantId: tenantContext.tenantId,
			role: created.role,
			temporaryPassword,
		}
	}

	public async patchTenantUser(
		userId: string,
		requestBody: UpdateTenantUserRequestBody,
		requestContext: RequestContext,
	): Promise<TenantUserSummary> {
		const updated = await this.mongoDbClient.updateTenantUser(
			userId,
			requestBody,
			requestContext,
		)

		return this.mapTenantUser(updated)
	}

	public async deleteTenantUser(
		userId: string,
		requestContext: RequestContext,
	): Promise<void> {
		await this.mongoDbClient.deleteTenantUser(userId, requestContext)
	}

	public async getTenants(
		requestContext: RequestContext,
	): Promise<TenantSummary[]> {
		ensureSuperAdmin(requestContext)

		const tenants = await Tenant.find()
			.sort({ createdAt: -1 })
			.lean<ITenant[]>()

		const synced = await Promise.all(
			tenants.map(async tenant => (await syncTenantSubscription(tenant)).tenant),
		)

		return synced.map(tenant => mapTenantSummary(tenant))
	}

	public async patchTenant(
		tenantId: string,
		requestBody: UpdateTenantRequestBody,
		requestContext: RequestContext,
	): Promise<TenantSummary> {
		ensureSuperAdmin(requestContext)

		const tenant = await Tenant.findOne({ tenantId }).lean<ITenant | null>()

		if (!tenant) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Tenant not found.',
			)
		}

		const permissions = getTenantPermissions(tenant)
		const updates: Record<string, unknown> = {}

		if (
			requestBody.tenantName !== undefined ||
			requestBody.status !== undefined
		) {
			if (!permissions.canUpdate) {
				throw new BusinessLogicError(
					ERROR_CODES.AUTHORIZATION.FORBIDDEN,
					permissions.reason || 'Tenant cannot be modified.',
				)
			}
		}

		if (requestBody.accessiblePages !== undefined) {
			if (!permissions.canChangeTenantSettings) {
				throw new BusinessLogicError(
					ERROR_CODES.AUTHORIZATION.FORBIDDEN,
					permissions.reason || 'Tenant settings cannot be modified.',
				)
			}

			const sanitizedPages = sanitizeAccessiblePages(
				requestBody.accessiblePages,
			)

			if (sanitizedPages.length === 0) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'At least one accessible page is required.',
				)
			}

			if (sanitizedPages.length !== requestBody.accessiblePages.length) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
					'One or more accessible pages are invalid.....',
				)
			}

			updates.accessiblePages = sanitizedPages
		}

		const hasInvoiceAi = Array.isArray(updates.accessiblePages)
			? (updates.accessiblePages as ITenant['accessiblePages']).includes(
					TENANT_ACCESSIBLE_PAGE.INVOICE_AI,
				)
			: tenantHasInvoiceAi(tenant)
		const hadInvoiceAi = tenantHasInvoiceAi(tenant)

		if (requestBody.invoiceAiMonthlyLimit !== undefined && !hasInvoiceAi) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
				'Invoice AI monthly limit can only be set when Invoice AI is enabled.',
			)
		}

		if (hasInvoiceAi && !hadInvoiceAi) {
			if (!permissions.canChangeTenantSettings) {
				throw new BusinessLogicError(
					ERROR_CODES.AUTHORIZATION.FORBIDDEN,
					permissions.reason || 'Tenant settings cannot be modified.',
				)
			}

			const monthlyLimit =
				requestBody.invoiceAiMonthlyLimit !== undefined
					? parseInvoiceAiMonthlyLimit(requestBody.invoiceAiMonthlyLimit)
					: (tenant.invoiceAi?.monthlyLimit ?? DEFAULT_INVOICE_AI_MONTHLY_LIMIT)

			updates.invoiceAi = newInvoiceAiUsage(monthlyLimit, new Date())
		} else if (
			hasInvoiceAi &&
			requestBody.invoiceAiMonthlyLimit !== undefined
		) {
			if (!permissions.canChangeTenantSettings) {
				throw new BusinessLogicError(
					ERROR_CODES.AUTHORIZATION.FORBIDDEN,
					permissions.reason || 'Tenant settings cannot be modified.',
				)
			}

			const monthlyLimit = parseInvoiceAiMonthlyLimit(
				requestBody.invoiceAiMonthlyLimit,
			)

			if (!tenant.invoiceAi?.activatedAt) {
				updates.invoiceAi = newInvoiceAiUsage(monthlyLimit, new Date())
			} else {
				updates['invoiceAi.monthlyLimit'] = monthlyLimit
			}
		}

		if (requestBody.offlineEnabled !== undefined) {
			if (!permissions.canChangeTenantSettings) {
				throw new BusinessLogicError(
					ERROR_CODES.AUTHORIZATION.FORBIDDEN,
					permissions.reason || 'Tenant settings cannot be modified.',
				)
			}

			updates.offlineEnabled = requestBody.offlineEnabled
		}

		if (requestBody.tenantName?.trim()) {
			const nextTenantName = requestBody.tenantName.trim()
			const conflictingTenant = await Tenant.findOne({
				name: nextTenantName,
				tenantId: { $ne: tenantId },
			}).lean()

			if (conflictingTenant) {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					'Tenant already exists with the same name.',
				)
			}

			updates.name = nextTenantName
		}

		if (requestBody.status) {
			if (requestBody.status === 'active' && tenant.subscription) {
				const subscriptionView = toView(tenant.subscription)

				if (subscriptionView.remainingDays <= 0) {
					throw new BusinessLogicError(
						ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
						'Approve a renewal request before activating this tenant.',
					)
				}
			}

			updates.status = requestBody.status
		}

		if (Object.keys(updates).length === 0) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'No fields provided for update.',
			)
		}

		const updated = await Tenant.findOneAndUpdate(
			{ tenantId },
			{ $set: updates },
			{ new: true, runValidators: true },
		).lean<ITenant | null>()

		if (!updated) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Tenant not found.',
			)
		}

		return mapTenantSummary(updated)
	}

	public async deleteTenant(
		tenantId: string,
		requestContext: RequestContext,
	): Promise<void> {
		ensureSuperAdmin(requestContext)

		const tenant = await Tenant.findOne({ tenantId }).lean<ITenant | null>()

		if (!tenant) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_DELETE_ERROR,
				'Tenant not found.',
			)
		}

		const permissions = getTenantPermissions(tenant)

		if (!permissions.canDelete) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				permissions.reason || 'Tenant cannot be deleted.',
			)
		}

		await Promise.all([
			User.deleteMany({ tenantId }),
			RefreshToken.deleteMany({ tenantId }),
			Product.deleteMany({ tenantId }),
			Order.deleteMany({ tenantId }),
			Invoice.deleteMany({ tenantId }),
			Inventory.deleteMany({ tenantId }),
			Report.deleteMany({ tenantId }),
			SubscriptionRenewalRequest.deleteMany({ tenantId }),
		])

		await Tenant.deleteOne({ tenantId })
	}

	public async addTenant(
		requestBody: AddTenantRequestBody,
		requestContext: RequestContext,
	): Promise<AddTenantResponse> {
		ensureSuperAdmin(requestContext)
		const {
			tenantName,
			tenantDomain,
			ownerFirstName,
			ownerLastName,
			ownerEmail,
			ownerPassword,
		} = requestBody

		if (
			!tenantName ||
			!tenantDomain ||
			!ownerFirstName ||
			!ownerLastName ||
			!ownerEmail ||
			!ownerPassword
		) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'All tenant and owner fields are required.',
			)
		}

		const ownerEmailError = validateEmail(ownerEmail)

		if (ownerEmailError) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.INVALID_EMAIL_FORMAT,
				ownerEmailError,
			)
		}

		const normalizedDomain = tenantDomain.trim().toLowerCase()
		const normalizedOwnerEmail = ownerEmail.trim().toLowerCase()

		if (getEmailDomain(normalizedOwnerEmail) !== normalizedDomain) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Owner email domain must match tenant domain.',
			)
		}

		const existingTenant = await Tenant.findOne({
			$or: [{ name: tenantName.trim() }, { domain: normalizedDomain }],
		}).lean()

		if (existingTenant) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Tenant already exists with the same name or domain.',
			)
		}

		const tenantId = this.createTenantIdFromDomain(normalizedDomain)
		const tenantIdConflict = await Tenant.findOne({ tenantId }).lean()

		if (tenantIdConflict) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Tenant ID conflict detected. Choose a different domain.',
			)
		}

		const ownerPasswordError = validatePasswordStrength(ownerPassword)

		if (ownerPasswordError) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.WEAK_PASSWORD,
				ownerPasswordError,
			)
		}

		const hashedPassword = await bcrypt.hash(ownerPassword, 10)
		const now = new Date()
		const tenant = await Tenant.create({
			tenantId,
			name: tenantName.trim(),
			domain: normalizedDomain,
			status: 'active',
			accessiblePages: [...DEFAULT_TENANT_ACCESSIBLE_PAGES],
			subscription: createSubscription(now, now, getSubscriptionConfig()),
		})

		const owner = await User.create({
			tenantId,
			userId: uuidv4(),
			displayName: `${ownerFirstName.trim()} ${ownerLastName.trim()}`,
			user: {
				firstName: ownerFirstName.trim(),
				lastName: ownerLastName.trim(),
			},
			email: normalizedOwnerEmail,
			password: hashedPassword,
			role: 'owner',
			avatarColorId: Math.floor(Math.random() * 1000000),
			createdBy: {
				_id: requestContext.userId ?? '',
				displayName: `${ownerFirstName.trim()} ${ownerLastName.trim()}`,
				role: 'owner',
				createdAt: new Date(),
			},
		})

		return {
			tenantId: tenant.tenantId,
			tenantName: tenant.name,
			tenantDomain: tenant.domain,
			ownerUserId: owner.userId,
		}
	}

	public async getOwnSubscription(requestContext: RequestContext) {
		const tenantContext = getTenantContext(requestContext)
		const tenant = await Tenant.findOne({
			tenantId: tenantContext.tenantId,
		}).lean<ITenant | null>()

		if (!tenant) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_READ_ERROR,
				'Tenant not found.',
			)
		}

		const { view } = await syncTenantSubscription(tenant)
		const canRole =
			tenantContext.role === 'owner' || tenantContext.role === 'admin'
		const [pending, latest] = await Promise.all([
			getPendingRequest(tenantContext.tenantId),
			getLatestRequest(tenantContext.tenantId),
		])
		const canRequestRenewal =
			canRole &&
			!pending &&
			Boolean(view && (view.warning || view.expired))

		return {
			subscription: view ? { ...view, canRequestRenewal } : null,
			pendingRequest: pending ? toRenewalRequestView(pending) : null,
			latestRequest: latest ? toRenewalRequestView(latest) : null,
		}
	}

	public async getSubscriptionPaymentInfo(_requestContext: RequestContext) {
		getTenantContext(_requestContext)

		return getPaymentSettings()
	}

	public async createOwnRenewalRequest(requestContext: RequestContext) {
		assertCanRequestRenewal(requestContext)
		const tenantContext = getTenantContext(requestContext)
		const tenant = await Tenant.findOne({
			tenantId: tenantContext.tenantId,
		}).lean<ITenant | null>()

		if (!tenant) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_CREATE_ERROR,
				'Tenant not found.',
			)
		}

		const request = await createRenewalRequest(tenant, requestContext)

		return { request }
	}

	public async listRenewalRequests(requestContext: RequestContext) {
		ensureSuperAdmin(requestContext)

		const requests = await listAllRenewalRequests()

		return { requests }
	}

	public async approveTenantRenewalRequest(
		requestId: string,
		requestContext: RequestContext,
	) {
		ensureSuperAdmin(requestContext)

		const request = await approveRenewalRequest(requestId, requestContext)

		return { request }
	}

	public async rejectTenantRenewalRequest(
		requestId: string,
		reason: string,
		requestContext: RequestContext,
	) {
		ensureSuperAdmin(requestContext)

		const request = await rejectRenewalRequest(
			requestId,
			reason,
			requestContext,
		)

		return { request }
	}

	public async getSubscriptionPaymentSettings(requestContext: RequestContext) {
		ensureSuperAdmin(requestContext)

		return getPaymentSettings()
	}

	public async saveSubscriptionPaymentSettings(
		body: Parameters<typeof savePaymentSettings>[0],
		requestContext: RequestContext,
	) {
		ensureSuperAdmin(requestContext)

		return savePaymentSettings(body)
	}
}
