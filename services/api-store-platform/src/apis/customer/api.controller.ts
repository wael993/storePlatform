import { v4 as uuidv4 } from 'uuid'

import { BusinessLogicError } from '../../middleware/errorHandler'
import { Customer } from '../../models/Customer'
import { Invoice } from '../../models/Invoice'
import { SellingInvoiceItem } from '../../models/SellingInvoices'
import { ERROR_CODES } from '../../shared/errorCodes'
import logger, { EntityType } from '../../shared/logger/logger'
import MongodbController from '../../shared/mongodb/mongodbController'
import { withTenantScope } from '../../shared/mongodb/tenantScopedModel'
import { redisCache } from '../../shared/cache/redisCache'
import { COLLECTION_NAMES } from '../../shared/general'
import { SEE } from '../../shared/seeCatalog'
import { ensureSeeIds } from '../../shared/seePermissions'
import { getTenantContext } from '../../shared/tenant'
import {
	CreateCustomerResponse,
	CustomerDocument,
	CustomerInvoiceSummary,
	CustomerRequestBody,
	RequestContext,
} from '../../shared/types'
import {
	CustomerResponse,
	CustomersResponse,
	DailyActionResponse,
} from '../../shared/types/api'
import {
	filterCustomerRelatedActions,
	mapCustomer,
	mapCustomers,
} from '../mappings/mapper'

export type CustomerInvoiceCollaborator = {
	getDailyActions(requestContext: RequestContext): Promise<DailyActionResponse>
	buildCustomerInvoiceSummary(
		invoices: Array<Record<string, unknown>>,
		customerEntries?: DailyActionResponse['data'],
	): CustomerInvoiceSummary
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const canSeeReceivable = (requestContext: RequestContext) =>
	(requestContext.see || []).includes('customers.totalReceivable')

const omitReceivableIfHidden = (
	customer: CustomerResponse,
	requestContext: RequestContext,
): CustomerResponse => {
	if (canSeeReceivable(requestContext)) return customer

	const { ...row } = customer

	return row
}

export default class CustomerController {
	constructor(
		private mongoDbClient: MongodbController,
		private invoiceCollaborator: CustomerInvoiceCollaborator,
	) {}

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

	public async getCustomers(
		requestContext: RequestContext,
	): Promise<CustomersResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildCustomerListKey(tenantId)
		const cachedCustomers =
			await redisCache.getJson<CustomersResponse>(cacheKey)

		if (cachedCustomers) {
			return {
				...cachedCustomers,
				data: cachedCustomers.data.map(customer =>
					omitReceivableIfHidden(customer, requestContext),
				),
			}
		}

		const customers = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.CUSTOMERS,
			model: Customer,
			sort: { createdAt: 'desc' },
		})

		const dailyActions =
			await this.invoiceCollaborator.getDailyActions(requestContext)
		const sellingInvoices: unknown[] = (
			await this.mongoDbClient.getDocuments({
				requestContext,
				collectionName: COLLECTION_NAMES.INVOICES,
				model: Invoice,
				sort: { createdAt: 'desc' },
			})
		).documents

		const invoicesByCustomerId = new Map<
			string,
			Array<Record<string, unknown>>
		>()

		for (const invoice of sellingInvoices) {
			if (!isPlainRecord(invoice)) continue

			const customerId = String(invoice.customerId ?? '')

			if (!customerId) continue

			const existing = invoicesByCustomerId.get(customerId)

			if (existing) {
				existing.push(invoice)
			} else {
				invoicesByCustomerId.set(customerId, [invoice])
			}
		}

		const data = customers.documents.map((customer: CustomerDocument) => {
			const relatedActions = filterCustomerRelatedActions(
				dailyActions.data,
				customer,
			)
			const { totalReceivable } =
				this.invoiceCollaborator.buildCustomerInvoiceSummary(
					invoicesByCustomerId.get(customer.customerId) ?? [],
					relatedActions,
				)

			return {
				customerId: customer.customerId,
				name: customer.name,
				internalCode: customer.internalCode,
				createdAt: customer.createdAt?.toISOString(),
				updatedAt: customer.updatedAt?.toISOString(),
				totalReceivable,
				createdBy: customer.createdBy
					? {
							...customer.createdBy,
							createdAt:
								customer.createdBy.createdAt instanceof Date
									? customer.createdBy.createdAt.toISOString()
									: (customer.createdAt?.toISOString() ?? ''),
						}
					: undefined,
				updatedBy: customer.updatedBy
					? {
							...customer.updatedBy,
							updatedAt: customer.updatedBy.updatedAt.toISOString(),
						}
					: undefined,
				relatedActions,
			}
		})

		const mappedCustomers = mapCustomers(data)
		const response: CustomersResponse = {
			data: mappedCustomers,
			totalCount: mappedCustomers.length,
		}

		await redisCache.setJson(cacheKey, response)

		return {
			...response,
			data: response.data.map(customer =>
				omitReceivableIfHidden(customer, requestContext),
			),
		}
	}

	public async getCustomer(
		customerId: string,
		requestContext: RequestContext,
	): Promise<CustomerResponse | null> {
		const customer =
			await this.mongoDbClient.getDocumentByField<CustomerDocument>(
				requestContext,
				COLLECTION_NAMES.CUSTOMERS,
				Customer,
				{ fieldName: 'customerId', fieldValue: customerId },
			)

		if (!customer) {
			return null
		}

		const dailyActions =
			await this.invoiceCollaborator.getDailyActions(requestContext)

		return omitReceivableIfHidden(
			mapCustomer(
				customer,
				filterCustomerRelatedActions(dailyActions.data, customer),
			),
			requestContext,
		)
	}

	public async postCustomer(
		requestContext: RequestContext,
		requestBody: CustomerRequestBody,
	): Promise<CreateCustomerResponse | null> {
		await ensureSeeIds(requestContext, [SEE.customersAdd])
		const { name, internalCode } = requestBody
		const tenantContext = getTenantContext(requestContext)

		if (!name || !name.trim()) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Customer name is required',
			)
		}

		const existing = await withTenantScope(
			Customer.findOne({
				name: new RegExp(`^${this.escapeRegex(name)}$`, 'i'),
			}),
			tenantContext.tenantId,
		).lean()

		if (existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Customer already exists in this tenant.',
			)
		}

		const customerId = this.resolveSyncClientId(requestBody.customerId)

		const existingById = await withTenantScope(
			Customer.findOne({ customerId }).lean(),
			tenantContext.tenantId,
		)

		if (existingById) {
			return {
				_id: String(existingById._id),
				customerId: existingById.customerId,
			}
		}

		const customerData: Record<string, unknown> = {
			customerId,
			internalCode: internalCode?.trim() || undefined,
			name,
		}

		logger.info('Saving customer to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			customerId,
			name,
		})

		const createCustomerResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.CUSTOMERS, data: customerData },
			Customer,
			requestContext,
		)

		logger.info('Customer created successfully.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			customerId,
			name,
		})

		await redisCache.del(
			redisCache.buildCustomerListKey(tenantContext.tenantId),
		)

		return {
			_id: createCustomerResponse._id,
		}
	}

	private async findCustomerDeleteBlocks(tenantId: string, ids: string[]) {
		const uniqueIds = [...new Set(ids.filter(Boolean))]
		const blocked = new Map<string, string>()
		const reason = 'This customer has selling invoices and cannot be deleted.'
		const [invoices, sellingItems] = await Promise.all([
			withTenantScope(
				Invoice.find({ customerId: { $in: uniqueIds } })
					.select({ customerId: 1 })
					.lean(),
				tenantId,
			),
			withTenantScope(
				SellingInvoiceItem.find({ customerId: { $in: uniqueIds } })
					.select({ customerId: 1 })
					.lean(),
				tenantId,
			),
		])

		for (const row of [...invoices, ...sellingItems]) {
			if (row.customerId && !blocked.has(row.customerId)) {
				blocked.set(row.customerId, reason)
			}
		}

		return blocked
	}

	public async deleteCustomer(
		customerId: string,
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.customersDelete])

		const tenantContext = getTenantContext(requestContext)
		const blocked = await this.findCustomerDeleteBlocks(
			tenantContext.tenantId,
			[customerId],
		)
		const reason = blocked.get(customerId)

		if (reason) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				reason,
			)
		}

		const deleteResponse = await this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.CUSTOMERS, id: customerId },
			requestContext,
			Customer,
		)

		await redisCache.del(
			redisCache.buildCustomerListKey(tenantContext.tenantId),
		)

		return deleteResponse
	}

	public async bulkDeleteCustomers(
		customerIds: string[],
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.customersDelete])

		const tenantContext = getTenantContext(requestContext)
		const ids = [...new Set(customerIds.filter(Boolean))]
		const blocked = await this.findCustomerDeleteBlocks(
			tenantContext.tenantId,
			ids,
		)
		const deleted: string[] = []
		const blockedRows: Array<{ customerId: string; reason: string }> = []

		for (const customerId of ids) {
			const reason = blocked.get(customerId)

			if (reason) {
				blockedRows.push({ customerId, reason })

				continue
			}

			try {
				await this.mongoDbClient.deleteDocument(
					{ collectionName: COLLECTION_NAMES.CUSTOMERS, id: customerId },
					requestContext,
					Customer,
				)

				deleted.push(customerId)
			} catch {
				blockedRows.push({
					customerId,
					reason: 'Customer could not be deleted.',
				})
			}
		}

		if (deleted.length) {
			await redisCache.del(
				redisCache.buildCustomerListKey(tenantContext.tenantId),
			)
		}

		return { deleted, blocked: blockedRows }
	}
}
