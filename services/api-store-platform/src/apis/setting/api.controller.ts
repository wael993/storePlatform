import express from 'express'

import {
	AuthorizationError,
	BusinessLogicError,
} from '../../middleware/errorHandler'
import { Currency } from '../../models/Currency'
import CurrencySettings, {
	ICurrencySettingItem,
	ICurrencySettings,
} from '../../models/CurrencySettings'
import InvoiceSettings, { IInvoiceSettings } from '../../models/InvoiceSettings'
import {
	cloneLabelLayout,
	ILabelTemplate,
	LabelTemplate,
	LabelTemplateDto,
	SYSTEM_LABEL_LAYOUT,
	SYSTEM_LABEL_TEMPLATE_ID,
	systemLabelTemplateDto,
	toLabelTemplateDto,
	validateLabelLayout,
} from '../../models/LabelTemplate'
import UserSettings, { IUserSettings } from '../../models/UserSettings'
import { ERROR_CODES } from '../../shared/errorCodes'
import logger from '../../shared/logger/logger'
import { withTenantScope } from '../../shared/mongodb/tenantScopedModel'
import { redisCache } from '../../shared/cache/redisCache'
import { getTenantContext } from '../../shared/tenant'
import {
	CreateCurrencyResponse,
	CurrencyRequestBody,
	RequestContext,
} from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'

const assertSettingsMutableWhileOnline = (
	request: Pick<express.Request, 'headers'>,
): void => {
	const raw = request.headers['x-work-mode']
	const workMode = String(Array.isArray(raw) ? raw[0] : (raw ?? ''))
		.trim()
		.toLowerCase()

	if (workMode === 'offline') {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Settings cannot be changed while the client is in offline work mode',
		)
	}
}

export type CurrencyCatalogCollaborator = {
	postCurrency(
		requestContext: RequestContext,
		requestBody: CurrencyRequestBody,
	): Promise<CreateCurrencyResponse | null>
}

type SettingsHttpRequest = express.Request & {
	user?: RequestContext['user'] & {
		userId?: string
		tenantId?: string
		tenantName?: string
		role?: RequestContext['role']
	}
	allowedFields?: string[]
}

export default class SettingController {
	constructor(private currencyCatalog: CurrencyCatalogCollaborator) {}

	private getTenantId(requestContext: RequestContext): string {
		return requestContext.tenantId || 'global'
	}

	private escapeRegex(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	}

	private resolveSyncClientId(clientId?: string): string {
		const trimmed = clientId?.trim()

		if (trimmed && /^[0-9a-f-]{36}$/i.test(trimmed)) {
			return trimmed
		}

		return uuidv4()
	}

	private getRequestContext(request: SettingsHttpRequest): RequestContext {
		return {
			userId: request.user?.userId,
			tenantId: request.user?.tenantId,
			tenantName: request.user?.tenantName,
			role: request.user?.role,
			user: request.user,
			allowedFields: request.allowedFields || [],
		}
	}

	public async getUserSettings(
		request: SettingsHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const { tenantId, userId } = request.user ?? {}

			if (!tenantId || !userId) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'Missing tenantId or userId',
				)
			}

			let userSettings = await UserSettings.findOne({
				tenantId,
				userId,
			})

			if (!userSettings) {
				userSettings = await UserSettings.create({
					tenantId,
					userId,
					productsPerPage: 20,
					displayLanguage: 'en',
				})
			}

			response.status(200).json(userSettings)
		} catch (error: unknown) {
			logger.error('Error fetching user settings', error)

			throw error
		}
	}

	public async patchUserSettings(
		request: SettingsHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			assertSettingsMutableWhileOnline(request)

			const { tenantId, userId } = request.user ?? {}
			const { productsPerPage, displayLanguage, defaultInvoiceCurrencyId } =
				request.body

			if (!tenantId || !userId) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'Missing tenantId or userId',
				)
			}

			const updateData: Partial<IUserSettings> = {}

			if (productsPerPage !== undefined) {
				updateData.productsPerPage = productsPerPage
			}

			if (displayLanguage !== undefined) {
				updateData.displayLanguage = displayLanguage
			}

			if (defaultInvoiceCurrencyId !== undefined) {
				updateData.defaultInvoiceCurrencyId =
					defaultInvoiceCurrencyId?.trim() || undefined
			}

			const userSettings = await UserSettings.findOneAndUpdate(
				{ tenantId, userId },
				updateData,
				{ new: true, upsert: true },
			)

			response.status(200).json(userSettings)
		} catch (error: unknown) {
			logger.error('Error updating user settings', error)

			throw error
		}
	}

	public async getCurrencySettings(
		request: SettingsHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const { tenantId } = request.user ?? {}

			if (!tenantId) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'Missing tenantId',
				)
			}

			let currencySettings = await CurrencySettings.findOne({ tenantId })

			if (!currencySettings) {
				currencySettings = await CurrencySettings.create({
					tenantId,
					primaryCurrency: null,
					secondaryCurrencies: [],
				})
			}

			response.status(200).json(currencySettings)
		} catch (error: unknown) {
			logger.error('Error fetching currency settings', error)

			throw error
		}
	}

	public async patchCurrencySettings(
		request: SettingsHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			assertSettingsMutableWhileOnline(request)

			const { tenantId, userId } = request.user ?? {}
			const { primaryCurrency, secondaryCurrencies } = request.body

			if (!tenantId || !userId) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'Missing tenantId or userId',
				)
			}

			const currencySettings = await this.applyCurrencySettingsUpdate(
				this.getRequestContext(request),
				{ primaryCurrency, secondaryCurrencies },
			)

			response.status(200).json(currencySettings)
		} catch (error: unknown) {
			logger.error('Error updating currency settings', error)

			throw error
		}
	}

	public async applyCurrencySettingsUpdate(
		requestContext: RequestContext,
		body: {
			primaryCurrency?: ICurrencySettingItem | null
			secondaryCurrencies?: ICurrencySettingItem[]
		},
	): Promise<ICurrencySettings> {
		const tenantId = this.getTenantId(requestContext)
		const { primaryCurrency, secondaryCurrencies } = body

		if (primaryCurrency && !primaryCurrency.name?.trim()) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'Primary currency name is required',
			)
		}

		const normalizedPrimary: ICurrencySettingItem | null = primaryCurrency
			? {
					currencyId: this.resolveSyncClientId(primaryCurrency.currencyId),
					name: primaryCurrency.name.trim(),
					internalCode: primaryCurrency.internalCode?.trim() || undefined,
				}
			: null

		const normalizedSecondary: ICurrencySettingItem[] = Array.isArray(
			secondaryCurrencies,
		)
			? secondaryCurrencies
					.filter(
						(item: ICurrencySettingItem) =>
							item?.name?.trim() && Number(item.exchangeRate) > 0,
					)
					.map((item: ICurrencySettingItem) => ({
						currencyId: this.resolveSyncClientId(item.currencyId),
						name: item.name.trim(),
						internalCode: item.internalCode?.trim() || undefined,
						exchangeRate: Number(item.exchangeRate),
						exchangeRateUnitCurrencyId:
							item.exchangeRateUnitCurrencyId?.trim() || undefined,
					}))
			: []

		const existingSettings = await CurrencySettings.findOne({ tenantId })

		let resolvedPrimary: ICurrencySettingItem | null = null

		if (normalizedPrimary) {
			resolvedPrimary = await this.syncCurrencyFromSettings(
				requestContext,
				normalizedPrimary,
			)
		}

		const resolvedSecondary: ICurrencySettingItem[] = await Promise.all(
			normalizedSecondary.map(async item => {
				const resolved = await this.syncCurrencyFromSettings(
					requestContext,
					item,
				)

				return {
					...resolved,
					exchangeRate: item.exchangeRate,
					exchangeRateUnitCurrencyId: item.exchangeRateUnitCurrencyId,
				}
			}),
		)

		const previousSecondaryIds =
			existingSettings?.secondaryCurrencies?.map(item => item.currencyId) ?? []
		const nextSecondaryIds = new Set(
			resolvedSecondary.map(item => item.currencyId),
		)
		const removedSecondaryIds = previousSecondaryIds.filter(
			currencyId => !nextSecondaryIds.has(currencyId),
		)

		if (removedSecondaryIds.length > 0) {
			await this.deleteCurrenciesByIds(requestContext, removedSecondaryIds)
		}

		const updateData: Partial<ICurrencySettings> = {
			primaryCurrency: resolvedPrimary,
			secondaryCurrencies: resolvedSecondary,
		}

		const currencySettings = await CurrencySettings.findOneAndUpdate(
			{ tenantId },
			updateData,
			{ new: true, upsert: true },
		)

		await redisCache.del(redisCache.buildCurrencyListKey(tenantId))

		return currencySettings!
	}

	public async getInvoiceSettings(
		request: SettingsHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const { tenantId } = request.user ?? {}

			if (!tenantId) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'Missing tenantId',
				)
			}

			let invoiceSettings = await InvoiceSettings.findOne({ tenantId })

			if (!invoiceSettings) {
				invoiceSettings = await InvoiceSettings.create({
					tenantId,
					noMergeInvoiceLines: false,
				})
			}

			response.status(200).json(invoiceSettings)
		} catch (error: unknown) {
			logger.error('Error fetching invoice settings', error)

			throw error
		}
	}

	public async patchInvoiceSettings(
		request: SettingsHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			assertSettingsMutableWhileOnline(request)

			const { tenantId, userId } = request.user ?? {}

			if (!tenantId || !userId) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'Missing tenantId or userId',
				)
			}

			const invoiceSettings = await this.applyInvoiceSettingsUpdate(
				this.getRequestContext(request),
				request.body,
			)

			response.status(200).json(invoiceSettings)
		} catch (error: unknown) {
			logger.error('Error updating invoice settings', error)

			throw error
		}
	}

	public async applyInvoiceSettingsUpdate(
		requestContext: RequestContext,
		body: {
			noMergeInvoiceLines?: boolean
			displayName?: string
			address?: string
			phone?: string
			email?: string
			taxNumber?: string
			logoUrl?: string
			qrUrl?: string
			footerNote?: string
		},
	): Promise<IInvoiceSettings> {
		const tenantId = this.getTenantId(requestContext)
		const updateData: Partial<IInvoiceSettings> = {}

		if (body.noMergeInvoiceLines !== undefined) {
			updateData.noMergeInvoiceLines = Boolean(body.noMergeInvoiceLines)
		}

		const stringFields = [
			'displayName',
			'address',
			'phone',
			'email',
			'taxNumber',
			'logoUrl',
			'qrUrl',
			'footerNote',
		] as const

		for (const field of stringFields) {
			if (body[field] !== undefined) {
				updateData[field] = String(body[field]).trim()
			}
		}

		const invoiceSettings = await InvoiceSettings.findOneAndUpdate(
			{ tenantId },
			updateData,
			{ new: true, upsert: true },
		)

		return invoiceSettings!
	}

	public async updateUserSettingsFromSync(
		requestContext: RequestContext,
		payload: Partial<
			Pick<
				IUserSettings,
				'productsPerPage' | 'displayLanguage' | 'defaultInvoiceCurrencyId'
			>
		>,
	): Promise<Record<string, unknown>> {
		const tenantContext = getTenantContext(requestContext)
		const updateData: Partial<IUserSettings> = {}

		if (payload.productsPerPage !== undefined) {
			updateData.productsPerPage = payload.productsPerPage
		}

		if (payload.displayLanguage !== undefined) {
			updateData.displayLanguage = payload.displayLanguage
		}

		if (payload.defaultInvoiceCurrencyId !== undefined) {
			updateData.defaultInvoiceCurrencyId =
				payload.defaultInvoiceCurrencyId?.trim() || undefined
		}

		const userSettings = await withTenantScope(
			UserSettings.findOneAndUpdate(
				{ userId: requestContext.userId },
				updateData,
				{ new: true, upsert: true },
			).lean(),
			tenantContext.tenantId,
		)

		return (userSettings ?? {}) as Record<string, unknown>
	}

	private async syncCurrencyFromSettings(
		requestContext: RequestContext,
		currency: Pick<
			ICurrencySettingItem,
			'currencyId' | 'name' | 'internalCode'
		>,
	): Promise<
		Pick<ICurrencySettingItem, 'currencyId' | 'name' | 'internalCode'>
	> {
		const tenantContext = getTenantContext(requestContext)
		const normalizedName = currency.name.trim()
		const normalizedCode =
			currency.internalCode?.trim().toUpperCase() || undefined

		const existing =
			(await this.findCurrencyForSettings(
				tenantContext.tenantId,
				currency.currencyId,
				normalizedCode,
				normalizedName,
			)) ?? null

		if (existing) {
			const nameChanged = existing.name !== normalizedName
			const codeChanged =
				(existing.internalCode ?? undefined) !== normalizedCode

			if (nameChanged || codeChanged) {
				if (normalizedCode) {
					const conflictingCode = await withTenantScope(
						Currency.findOne({
							internalCode: normalizedCode,
							currencyId: { $ne: existing.currencyId },
						}).lean(),
						tenantContext.tenantId,
					)

					if (conflictingCode) {
						throw new BusinessLogicError(
							ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
							'Currency code already exists in this tenant.',
						)
					}
				}

				await withTenantScope(
					Currency.findOneAndUpdate(
						{ currencyId: existing.currencyId },
						{
							$set: {
								name: normalizedName,
								internalCode: normalizedCode,
								updatedBy: {
									_id: requestContext.userId ?? '',
									displayName:
										`${requestContext.user?.firstName ?? ''} ${requestContext.user?.lastName ?? ''}`.trim(),
									updatedAt: new Date(),
								},
							},
						},
						{ new: true, runValidators: true },
					),
					tenantContext.tenantId,
				)
			}

			return {
				currencyId: existing.currencyId,
				name: normalizedName,
				internalCode: normalizedCode,
			}
		}

		await this.currencyCatalog.postCurrency(requestContext, {
			currencyId: currency.currencyId,
			name: normalizedName,
			internalCode: normalizedCode,
		})

		return {
			currencyId: currency.currencyId,
			name: normalizedName,
			internalCode: normalizedCode,
		}
	}

	private async findCurrencyForSettings(
		tenantId: string,
		currencyId: string,
		internalCode?: string,
		name?: string,
	) {
		const existingById = await withTenantScope(
			Currency.findOne({ currencyId }).lean(),
			tenantId,
		)

		if (existingById) {
			return existingById
		}

		if (internalCode) {
			const existingByCode = await withTenantScope(
				Currency.findOne({ internalCode }).lean(),
				tenantId,
			)

			if (existingByCode) {
				return existingByCode
			}
		}

		if (name) {
			const existingByName = await withTenantScope(
				Currency.findOne({
					name: new RegExp(`^${this.escapeRegex(name)}$`, 'i'),
				}).lean(),
				tenantId,
			)

			if (existingByName) {
				return existingByName
			}
		}

		return null
	}

	private async deleteCurrenciesByIds(
		requestContext: RequestContext,
		currencyIds: string[],
	): Promise<void> {
		const tenantContext = getTenantContext(requestContext)

		await Currency.deleteMany({
			tenantId: tenantContext.tenantId,
			currencyId: { $in: currencyIds },
		})
	}

	private assertOwnerOrAdmin(request: SettingsHttpRequest): void {
		const role = request.user?.role

		if (role !== 'owner' && role !== 'admin') {
			throw new AuthorizationError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Only owner or admin can manage label templates',
			)
		}
	}

	private actor(request: SettingsHttpRequest) {
		return {
			_id: request.user?.userId ?? '',
			displayName:
				`${request.user?.firstName ?? ''} ${request.user?.lastName ?? ''}`.trim() ||
				'user',
			role: request.user?.role,
			createdAt: new Date(),
		}
	}

	private async listCustomTemplates(
		tenantId: string,
	): Promise<ILabelTemplate[]> {
		return LabelTemplate.find({ tenantId }).sort({ createdAt: 1 })
	}

	private async requireCustomTemplate(
		tenantId: string,
		templateId: string,
	): Promise<ILabelTemplate> {
		const template = await LabelTemplate.findOne({ tenantId, templateId })

		if (!template) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_READ_ERROR,
				'Label template not found',
			)
		}

		return template
	}

	public async getLabelTemplates(
		request: SettingsHttpRequest,
		response: express.Response,
	): Promise<void> {
		const { tenantId } = request.user ?? {}

		if (!tenantId) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'Missing tenantId',
			)
		}

		const custom = await this.listCustomTemplates(tenantId)
		const hasCustomDefault = custom.some(template => template.isDefault)

		response.status(200).json({
			templates: [
				systemLabelTemplateDto(!hasCustomDefault),
				...custom.map(toLabelTemplateDto),
			],
		})
	}

	public async createLabelTemplate(
		request: SettingsHttpRequest,
		response: express.Response,
	): Promise<void> {
		assertSettingsMutableWhileOnline(request)
		this.assertOwnerOrAdmin(request)

		const { tenantId } = request.user ?? {}

		if (!tenantId) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'Missing tenantId',
			)
		}

		const name = String(request.body?.name ?? '').trim()

		if (!name) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'Template name is required',
			)
		}

		let layout: ReturnType<typeof validateLabelLayout>

		try {
			layout = validateLabelLayout(
				request.body?.layout ?? cloneLabelLayout(SYSTEM_LABEL_LAYOUT),
			)
		} catch (error: unknown) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
				error instanceof Error ? error.message : 'Invalid layout',
			)
		}

		const template = await LabelTemplate.create({
			tenantId,
			templateId: uuidv4(),
			name,
			isDefault: false,
			layout,
			createdBy: this.actor(request),
		})

		response.status(201).json(toLabelTemplateDto(template))
	}

	public async patchLabelTemplate(
		request: SettingsHttpRequest,
		response: express.Response,
	): Promise<void> {
		assertSettingsMutableWhileOnline(request)
		this.assertOwnerOrAdmin(request)

		const { tenantId } = request.user ?? {}
		const templateId = String(request.params.templateId ?? '')

		if (!tenantId || !templateId) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'Missing tenantId or templateId',
			)
		}

		if (templateId === SYSTEM_LABEL_TEMPLATE_ID) {
			throw new AuthorizationError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'System default template cannot be edited',
			)
		}

		const template = await this.requireCustomTemplate(tenantId, templateId)
		const name =
			request.body?.name !== undefined
				? String(request.body.name).trim()
				: template.name

		if (!name) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'Template name is required',
			)
		}

		let layout = template.layout

		if (request.body?.layout !== undefined) {
			try {
				layout = validateLabelLayout(request.body.layout)
			} catch (error: unknown) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
					error instanceof Error ? error.message : 'Invalid layout',
				)
			}
		}

		template.name = name
		template.layout = layout
		template.updatedBy = {
			_id: request.user?.userId ?? '',
			displayName: this.actor(request).displayName,
			role: request.user?.role,
			updatedAt: new Date(),
		}

		await template.save()

		response.status(200).json(toLabelTemplateDto(template))
	}

	public async deleteLabelTemplate(
		request: SettingsHttpRequest,
		response: express.Response,
	): Promise<void> {
		assertSettingsMutableWhileOnline(request)
		this.assertOwnerOrAdmin(request)

		const { tenantId } = request.user ?? {}
		const templateId = String(request.params.templateId ?? '')

		if (!tenantId || !templateId) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'Missing tenantId or templateId',
			)
		}

		if (templateId === SYSTEM_LABEL_TEMPLATE_ID) {
			throw new AuthorizationError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'System default template cannot be deleted',
			)
		}

		const template = await this.requireCustomTemplate(tenantId, templateId)

		if (template.isDefault) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Default template cannot be deleted',
			)
		}

		await template.deleteOne()

		response.status(204).send()
	}

	public async duplicateLabelTemplate(
		request: SettingsHttpRequest,
		response: express.Response,
	): Promise<void> {
		assertSettingsMutableWhileOnline(request)
		this.assertOwnerOrAdmin(request)

		const { tenantId } = request.user ?? {}
		const templateId = String(request.params.templateId ?? '')

		if (!tenantId || !templateId) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'Missing tenantId or templateId',
			)
		}

		const source: LabelTemplateDto =
			templateId === SYSTEM_LABEL_TEMPLATE_ID
				? systemLabelTemplateDto(false)
				: toLabelTemplateDto(
						await this.requireCustomTemplate(tenantId, templateId),
					)

		const template = await LabelTemplate.create({
			tenantId,
			templateId: uuidv4(),
			name: `${source.name} copy`,
			isDefault: false,
			layout: cloneLabelLayout(source.layout),
			createdBy: this.actor(request),
		})

		response.status(201).json(toLabelTemplateDto(template))
	}

	public async setDefaultLabelTemplate(
		request: SettingsHttpRequest,
		response: express.Response,
	): Promise<void> {
		assertSettingsMutableWhileOnline(request)
		this.assertOwnerOrAdmin(request)

		const { tenantId } = request.user ?? {}
		const templateId = String(request.params.templateId ?? '')

		if (!tenantId || !templateId) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'Missing tenantId or templateId',
			)
		}

		if (templateId === SYSTEM_LABEL_TEMPLATE_ID) {
			await LabelTemplate.updateMany(
				{ tenantId },
				{ $set: { isDefault: false } },
			)
		} else {
			await this.requireCustomTemplate(tenantId, templateId)
			await LabelTemplate.updateMany(
				{ tenantId },
				{ $set: { isDefault: false } },
			)

			try {
				await LabelTemplate.updateOne(
					{ tenantId, templateId },
					{ $set: { isDefault: true } },
				)
			} catch (error: unknown) {
				const duplicateKey =
					typeof error === 'object' &&
					error !== null &&
					'code' in error &&
					error.code === 11000

				if (duplicateKey) {
					throw new BusinessLogicError(
						ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
						'Another template is already the default',
					)
				}

				throw error
			}
		}

		const templates = await this.listCustomTemplates(tenantId)
		const hasCustomDefault = templates.some(template => template.isDefault)

		response.status(200).json({
			templates: [
				systemLabelTemplateDto(!hasCustomDefault),
				...templates.map(toLabelTemplateDto),
			],
		})
	}
}
