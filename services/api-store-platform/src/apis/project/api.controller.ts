import { BusinessLogicError } from '../../middleware/errorHandler'
import { DailyAction } from '../../models/DailyAction'
import { Invoice } from '../../models/Invoice'
import { Project, type IProject } from '../../models/Project'
import { redisCache } from '../../shared/cache/redisCache'
import { loadCashCurrencyRates } from '../../shared/cashAccounts/posting'
import { ERROR_CODES } from '../../shared/errorCodes'
import { COLLECTION_NAMES } from '../../shared/general'
import logger, { EntityType } from '../../shared/logger/logger'
import MongodbController from '../../shared/mongodb/mongodbController'
import { withTenantScope } from '../../shared/mongodb/tenantScopedModel'
import { getTenantContext } from '../../shared/tenant'
import { filterByWarehouseAcl } from '../../shared/warehouseAccess'
import {
	amountToPrimaryWithSnapshot,
	type CostCurrencyRate,
} from '../../shared/inventoryCost'
import { SEE } from '../../shared/seeCatalog'
import { ensureSeeIds } from '../../shared/seePermissions'
import {
	DeleteBlockReason,
	stampDeleteAvailability,
} from '../../shared/deleteBlock'
import { resolveSyncClientId } from '../../shared/uuid'
import type { CustomerInvoiceSummary } from '../../shared/types'
import { ProjectRequestBody, RequestContext } from '../../shared/types'
import type { DailyActionResponse } from '../../shared/types/api'

type ProjectRow = {
	projectId: string
	name: string
	internalCode?: string
	contractCost?: number
	createdAt?: string
	updatedAt?: string
	createdBy?: {
		_id: string
		displayName: string
		role?: string
		createdAt: string
	}
	updatedBy?: {
		_id: string
		displayName: string
		role?: string
		updatedAt: string
	}
	outstanding?: number
	isDeletable?: boolean
	deleteBlockReason?: string | null
	invoices?: Array<Record<string, unknown>>
	buyingInvoices?: Array<Record<string, unknown>>
	projectEntries?: DailyActionResponse['data']
	invoiceSummary?: {
		totalInvoiced: number
		totalPaid: number
		outstanding: number
		employeeCosts: number
		otherCosts: number
		receiptEntries: number
		contractCost: number | null
		profit: number | null
	}
}

type ProjectsResponse = {
	data: ProjectRow[]
	totalCount: number
}

const entryPrimaryAmount = (
	entry: DailyActionResponse['data'][number],
	rates: readonly CostCurrencyRate[],
) => {
	const rawAmount = entry.totalPrice || entry.singleUnitPrice || '0'
	const amount = parseFloat(String(rawAmount).replace(/,/g, '')) || 0

	return amountToPrimaryWithSnapshot(
		amount,
		entry.currencyId,
		entry.exchangeRateToPrimary,
		rates,
	)
}

const sumEntries = (
	entries: DailyActionResponse['data'],
	entryType: string,
	rates: readonly CostCurrencyRate[],
) =>
	entries.reduce(
		(sum, entry) =>
			entry.entryType === entryType
				? sum + entryPrimaryAmount(entry, rates)
				: sum,
		0,
	)

const toIso = (value: Date | string | undefined) => {
	if (!value) return undefined

	if (value instanceof Date) return value.toISOString()

	return value
}

const mapProject = (project: IProject): ProjectRow => ({
	projectId: project.projectId,
	name: project.name,
	internalCode: project.internalCode,
	contractCost: project.contractCost,
	createdAt: toIso(project.createdAt),
	updatedAt: toIso(project.updatedAt),
	createdBy: project.createdBy
		? {
				...project.createdBy,
				createdAt:
					project.createdBy.createdAt instanceof Date
						? project.createdBy.createdAt.toISOString()
						: (toIso(project.createdAt) ?? ''),
			}
		: undefined,
	updatedBy: project.updatedBy
		? {
				...project.updatedBy,
				updatedAt:
					project.updatedBy.updatedAt instanceof Date
						? project.updatedBy.updatedAt.toISOString()
						: '',
			}
		: undefined,
})

type ProjectInvoiceCollaborator = {
	buildCustomerInvoiceSummary(
		invoices: Array<Record<string, unknown>>,
		customerEntries?: DailyActionResponse['data'],
		rates?: readonly CostCurrencyRate[],
	): CustomerInvoiceSummary
}

export default class ProjectController {
	constructor(
		private mongoDbClient: MongodbController,
		private invoices: ProjectInvoiceCollaborator,
	) {}

	private getTenantId(requestContext: RequestContext): string {
		return requestContext.tenantId || 'global'
	}

	private escapeRegex(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	}

	public async ensureProjectBelongsToTenant(
		requestContext: RequestContext,
		projectId?: string,
	) {
		if (!projectId) {
			return
		}

		const project = await this.mongoDbClient.getDocumentByField(
			requestContext,
			COLLECTION_NAMES.PROJECTS,
			Project,
			{
				fieldName: 'projectId',
				fieldValue: projectId,
			},
		)

		if (!project) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Invoice must reference a project from the same tenant.',
			)
		}
	}

	private projectOutstanding(
		invoices: Array<Record<string, unknown>>,
		entries: DailyActionResponse['data'],
		rates: readonly CostCurrencyRate[],
	) {
		const summaryEntries = entries.filter(entry => {
			const entryType = entry.entryType

			return entryType === 'RECEIPT_ENTRY' || entryType === 'PAYMENT_ENTRY'
		})
		const own = this.invoices.buildCustomerInvoiceSummary(
			invoices,
			summaryEntries,
			rates,
		)

		return (
			own.totalReceivable +
			sumEntries(entries, 'EMPLOYEE_COST', rates) +
			sumEntries(entries, 'OTHER_COST', rates)
		)
	}

	private async withProjectOutstanding<T extends { projectId: string }>(
		requestContext: RequestContext,
		rows: T[],
	) {
		if (rows.length === 0) {
			return rows.map(row => ({ ...row, outstanding: 0 }))
		}

		const tenantId = this.getTenantId(requestContext)
		const ids = [...new Set(rows.map(row => row.projectId).filter(Boolean))]
		const [sellingInvoices, entries, rates] = await Promise.all([
			withTenantScope(
				Invoice.find({ projectId: { $in: ids } }).lean<
					Array<
						Record<string, unknown> & {
							warehouseId?: string
							projectId?: string
						}
					>
				>(),
				tenantId,
			),
			withTenantScope(
				DailyAction.find({
					projectId: { $in: ids },
					entryType: {
						$in: [
							'RECEIPT_ENTRY',
							'PAYMENT_ENTRY',
							'EMPLOYEE_COST',
							'OTHER_COST',
						],
					},
				}).lean<DailyActionResponse['data']>(),
				tenantId,
			),
			loadCashCurrencyRates(tenantId),
		])
		const invoices = filterByWarehouseAcl(requestContext, sellingInvoices)
		const projectEntries = filterByWarehouseAcl(requestContext, entries)

		return rows.map(row => ({
			...row,
			outstanding: this.projectOutstanding(
				invoices.filter(invoice => invoice.projectId === row.projectId),
				projectEntries.filter(entry => entry.projectId === row.projectId),
				rates,
			),
		}))
	}

	public async getProjects(
		requestContext: RequestContext,
	): Promise<ProjectsResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildProjectListKey(tenantId)
		const cachedProjects = await redisCache.getJson<ProjectsResponse>(cacheKey)

		if (cachedProjects) {
			const withOutstanding = await this.withProjectOutstanding(
				requestContext,
				cachedProjects.data,
			)

			return {
				...cachedProjects,
				data: await this.withProjectDeleteFlags(tenantId, withOutstanding),
			}
		}

		const projects = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.PROJECTS,
			model: Project,
			sort: { createdAt: 'desc' },
		})

		const data = projects.documents.map((project: IProject) =>
			mapProject(project),
		)
		const response: ProjectsResponse = {
			data,
			totalCount: data.length,
		}

		await redisCache.setJson(cacheKey, response)

		const withOutstanding = await this.withProjectOutstanding(
			requestContext,
			response.data,
		)

		return {
			...response,
			data: await this.withProjectDeleteFlags(tenantId, withOutstanding),
		}
	}

	public async getProject(
		projectId: string,
		requestContext: RequestContext,
	): Promise<ProjectRow | null> {
		const project = await this.mongoDbClient.getDocumentByField<IProject>(
			requestContext,
			COLLECTION_NAMES.PROJECTS,
			Project,
			{ fieldName: 'projectId', fieldValue: projectId },
		)

		if (!project) {
			return null
		}

		const tenantId = this.getTenantId(requestContext)
		const [sellingInvoices, entries, rates] = await Promise.all([
			withTenantScope(
				Invoice.find({ projectId: project.projectId }).sort({
					createdAt: 'desc',
				}),
				tenantId,
			).lean<Array<Record<string, unknown> & { warehouseId?: string }>>(),
			withTenantScope(
				DailyAction.find({
					projectId: project.projectId,
					entryType: {
						$in: [
							'RECEIPT_ENTRY',
							'PAYMENT_ENTRY',
							'EMPLOYEE_COST',
							'OTHER_COST',
						],
					},
				}).sort({ createdAt: 'desc' }),
				tenantId,
			).lean<DailyActionResponse['data']>(),
			loadCashCurrencyRates(tenantId),
		])
		const invoices = filterByWarehouseAcl(requestContext, sellingInvoices)
		const projectEntries = filterByWarehouseAcl(requestContext, entries)
		const summaryEntries = projectEntries.filter(entry => {
			const entryType = entry.entryType

			return entryType === 'RECEIPT_ENTRY' || entryType === 'PAYMENT_ENTRY'
		})
		const own = this.invoices.buildCustomerInvoiceSummary(
			invoices,
			summaryEntries,
			rates,
		)
		const employeeCosts = sumEntries(projectEntries, 'EMPLOYEE_COST', rates)
		const otherCosts = sumEntries(projectEntries, 'OTHER_COST', rates)
		const contractCost = project.contractCost ?? null

		return {
			...mapProject(project),
			invoices,
			buyingInvoices: [],
			projectEntries,
			invoiceSummary: {
				totalInvoiced: own.totalInvoiced,
				totalPaid: own.totalPaid,
				outstanding: own.totalReceivable + employeeCosts + otherCosts,
				employeeCosts,
				otherCosts,
				receiptEntries: sumEntries(projectEntries, 'RECEIPT_ENTRY', rates),
				contractCost,
				profit:
					contractCost == null
						? null
						: contractCost - own.totalInvoiced - employeeCosts - otherCosts,
			},
		}
	}

	public async postProject(
		requestContext: RequestContext,
		requestBody: ProjectRequestBody,
	) {
		await ensureSeeIds(requestContext, [SEE.projectsAdd])
		const { name } = requestBody
		const tenantContext = getTenantContext(requestContext)

		if (!name || !name.trim()) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Project name is required',
			)
		}

		const existing = await withTenantScope(
			Project.findOne({
				name: new RegExp(`^${this.escapeRegex(name.trim())}$`, 'i'),
			}),
			tenantContext.tenantId,
		).lean()

		if (existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Project already exists in this tenant.',
			)
		}

		const projectId = resolveSyncClientId(requestBody.projectId)

		const existingById = await withTenantScope(
			Project.findOne({ projectId }).lean<IProject | null>(),
			tenantContext.tenantId,
		)

		if (existingById) {
			return {
				_id: String(existingById._id),
				projectId: existingById.projectId,
			}
		}

		const internalCode = requestBody.internalCode?.trim()
		const projectData: Record<string, unknown> = {
			projectId,
			name: name.trim(),
			...(internalCode ? { internalCode } : {}),
		}

		logger.info('Saving project to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			projectId,
			name: name.trim(),
		})

		const createProjectResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.PROJECTS, data: projectData },
			Project,
			requestContext,
		)

		logger.info('Project created successfully.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			projectId,
			name: name.trim(),
		})

		await redisCache.del(redisCache.buildProjectListKey(tenantContext.tenantId))

		return {
			_id: createProjectResponse._id,
		}
	}

	public async patchProject(
		projectId: string,
		requestBody: Partial<ProjectRequestBody>,
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.projectsAdd])
		const tenantId = this.getTenantId(requestContext)
		const updates: Record<string, unknown> = {
			updatedBy: {
				_id: requestContext.userId as string,
				displayName:
					`${requestContext.user?.firstName ?? ''} ${requestContext.user?.lastName ?? ''}`.trim(),
				role: requestContext.user?.role ?? requestContext.role,
				updatedAt: new Date(),
			},
		}

		if (requestBody.name !== undefined) {
			const name = requestBody.name.trim()

			if (!name) {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					'Project name is required',
				)
			}

			const duplicate = await withTenantScope(
				Project.findOne({
					projectId: { $ne: projectId },
					name: new RegExp(`^${this.escapeRegex(name)}$`, 'i'),
				}),
				tenantId,
			).lean()

			if (duplicate) {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					'Project already exists in this tenant.',
				)
			}

			updates.name = name
		}

		if (requestBody.internalCode !== undefined) {
			updates.internalCode = requestBody.internalCode.trim().toUpperCase()
		}

		if (requestBody.contractCost !== undefined) {
			const contractCost = Number(requestBody.contractCost)

			if (!Number.isFinite(contractCost) || contractCost < 0) {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					'Contract cost must be zero or greater.',
				)
			}

			updates.contractCost = contractCost
		}

		const updated = await withTenantScope(
			Project.findOneAndUpdate({ projectId }, { $set: updates }, { new: true }),
			tenantId,
		).lean<IProject | null>()

		if (!updated) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Project not found.',
			)
		}

		await redisCache.del(redisCache.buildProjectListKey(tenantId))

		return mapProject(updated)
	}

	private async findProjectDeleteBlocks(tenantId: string, ids: string[]) {
		const uniqueIds = [...new Set(ids.filter(Boolean))]
		const blocked = new Map<string, string>()
		const [invoices, actions] = await Promise.all([
			withTenantScope(
				Invoice.find({ projectId: { $in: uniqueIds } })
					.select({ projectId: 1 })
					.lean(),
				tenantId,
			),
			withTenantScope(
				DailyAction.find({ projectId: { $in: uniqueIds } })
					.select({ projectId: 1 })
					.lean(),
				tenantId,
			),
		])

		for (const row of invoices) {
			if (row.projectId && !blocked.has(row.projectId)) {
				blocked.set(row.projectId, DeleteBlockReason.invoice)
			}
		}

		for (const row of actions) {
			if (row.projectId && !blocked.has(row.projectId)) {
				blocked.set(row.projectId, DeleteBlockReason.dailyAction)
			}
		}

		return blocked
	}

	private async withProjectDeleteFlags<T extends { projectId: string }>(
		tenantId: string,
		rows: T[],
	) {
		const blocked = await this.findProjectDeleteBlocks(
			tenantId,
			rows.map(row => row.projectId),
		)

		return stampDeleteAvailability(rows, row => row.projectId, blocked)
	}

	public async deleteProject(
		projectId: string,
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.projectsDelete])

		const tenantContext = getTenantContext(requestContext)
		const blocked = await this.findProjectDeleteBlocks(tenantContext.tenantId, [
			projectId,
		])
		const reason = blocked.get(projectId)

		if (reason) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				reason,
			)
		}

		const deleteResponse = await this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.PROJECTS, id: projectId },
			requestContext,
			Project,
		)

		await redisCache.del(redisCache.buildProjectListKey(tenantContext.tenantId))

		return deleteResponse
	}

	public async bulkDeleteProjects(
		projectIds: string[],
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.projectsDelete])

		const tenantContext = getTenantContext(requestContext)
		const ids = [...new Set(projectIds.filter(Boolean))]
		const blocked = await this.findProjectDeleteBlocks(
			tenantContext.tenantId,
			ids,
		)
		const deleted: string[] = []
		const blockedRows: Array<{ projectId: string; reason: string }> = []

		for (const projectId of ids) {
			const reason = blocked.get(projectId)

			if (reason) {
				blockedRows.push({ projectId, reason })

				continue
			}

			try {
				await this.mongoDbClient.deleteDocument(
					{ collectionName: COLLECTION_NAMES.PROJECTS, id: projectId },
					requestContext,
					Project,
				)

				deleted.push(projectId)
			} catch {
				blockedRows.push({
					projectId,
					reason: 'Project could not be deleted.',
				})
			}
		}

		if (deleted.length) {
			await redisCache.del(
				redisCache.buildProjectListKey(tenantContext.tenantId),
			)
		}

		return { deleted, blocked: blockedRows }
	}
}
