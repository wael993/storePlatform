import { v4 as uuidv4 } from 'uuid'

import { BusinessLogicError } from '../../middleware/errorHandler'
import { Customer } from '../../models/Customer'
import { Invoice } from '../../models/Invoice'
import { ERROR_CODES } from '../../shared/errorCodes'
import logger, { EntityType } from '../../shared/logger/logger'
import MongodbController from '../../shared/mongodb/mongodbController'
import { withTenantScope } from '../../shared/mongodb/tenantScopedModel'
import { redisCache } from '../../shared/cache/redisCache'
import { COLLECTION_NAMES } from '../../shared/general'
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
	getDailyActions(
		requestContext: RequestContext,
	): Promise<DailyActionResponse>
	buildCustomerInvoiceSummary(
		invoices: Array<Record<string, unknown>>,
		customerEntries?: DailyActionResponse['data'],
	): CustomerInvoiceSummary
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

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
			return cachedCustomers
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

		const invoicesByCustomerId = new Map<string, Array<Record<string, unknown>>>()

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

		return response
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

		return mapCustomer(
			customer,
			filterCustomerRelatedActions(dailyActions.data, customer),
		)
	}

	public async postCustomer(
		requestContext: RequestContext,
		requestBody: CustomerRequestBody,
	): Promise<CreateCustomerResponse | null> {
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
}
