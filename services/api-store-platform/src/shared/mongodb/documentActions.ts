import { Model } from 'mongoose'
import { withTenantScope } from './tenantScopedModel'
import { RequestContext } from '../types'
import { TenantResource, ensureTenantAccess, getTenantContext } from '../tenant'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import logger, { EntityType } from '../logger/logger'
import { SortOrder } from 'mongoose'
import { COLLECTION_NAMES } from '../general'

type Sort = Record<string, SortOrder>

export type EntityModel = Model<any>

const STRING_AUDIT_RESOURCES = new Set<TenantResource>([
	COLLECTION_NAMES.ORDERS,
	COLLECTION_NAMES.REPORTS,
])

const RESOURCE_ID_FIELD: Record<TenantResource, string> = {
	[COLLECTION_NAMES.PRODUCTS]: 'productId',
	[COLLECTION_NAMES.CATEGORIES]: 'categoryId',
	[COLLECTION_NAMES.ORDERS]: 'orderId',
	[COLLECTION_NAMES.INVOICES]: 'invoiceId',
	[COLLECTION_NAMES.INVENTORY]: 'inventoryId',
	[COLLECTION_NAMES.REPORTS]: 'reportId',
	[COLLECTION_NAMES.DAILY_ACTIONS]: 'actionId',
	[COLLECTION_NAMES.SUPPLIERS]: 'supplierId',
	[COLLECTION_NAMES.CUSTOMERS]: 'customerId',
	[COLLECTION_NAMES.EXPENSES]: 'expenseId',
	[COLLECTION_NAMES.CURRENCIES]: 'currencyId',
	[COLLECTION_NAMES.UNITS]: 'unitId',
	[COLLECTION_NAMES.PARTNERS]: 'partnerId',
	[COLLECTION_NAMES.BRANDS]: '_id',
	[COLLECTION_NAMES.SHELVES]: 'shelfId',
	[COLLECTION_NAMES.WAREHOUSES]: 'warehouseId',
	[COLLECTION_NAMES.STOCK_MOVINGS]: 'stockMovingId',
	[COLLECTION_NAMES.SYNC_MUTATIONS]: 'clientMutationId',
	[COLLECTION_NAMES.USERS]: '_id',
	[COLLECTION_NAMES.TENANTS]: '_id',
}

const getUserDisplayName = (requestContext: RequestContext) =>
	`${requestContext.user?.firstName ?? ''} ${requestContext.user?.lastName ?? ''}`.trim()

const buildCreatedBy = (
	requestContext: RequestContext,
	resource: TenantResource,
) => {
	const userId = requestContext.userId ?? ''

	if (STRING_AUDIT_RESOURCES.has(resource)) {
		return userId
	}

	return {
		_id: userId,
		displayName: getUserDisplayName(requestContext),
		role: requestContext.user?.role ?? requestContext.role,
		createdAt: new Date(),
	}
}

const buildUpdatedBy = (
	requestContext: RequestContext,
	resource: TenantResource,
) => {
	const userId = requestContext.userId ?? ''

	if (STRING_AUDIT_RESOURCES.has(resource)) {
		return userId
	}

	return {
		_id: userId,
		displayName: getUserDisplayName(requestContext),
		role: requestContext.user?.role ?? requestContext.role,
		updatedAt: new Date(),
	}
}

export const getDocuments = async <T>(
	requestContext: RequestContext,
	collectionName: TenantResource,
	model: EntityModel,
	sort: Sort,
): Promise<T[]> => {
	await ensureTenantAccess(requestContext, collectionName, 'read')
	const tenantContext = getTenantContext(requestContext)

	return withTenantScope(model.find(), tenantContext.tenantId)
		.sort(sort)
		.lean<T[]>()
		.exec()
}

export const getDocumentByField = async <T>(
	requestContext: RequestContext,
	resource: TenantResource,
	model: EntityModel,
	{ fieldName, fieldValue }: Record<string, string>,
): Promise<T | null> => {
	await ensureTenantAccess(requestContext, resource, 'read')
	const tenantContext = getTenantContext(requestContext)

	return withTenantScope(
		model.findOne({ [fieldName]: fieldValue }),
		tenantContext.tenantId,
	)
		.lean<T>()
		.exec()
}

export const createDocument = async (
	requestContext: RequestContext,
	resource: TenantResource,
	model: EntityModel,
	payload: Record<string, unknown>,
): Promise<{ _id: string }> => {
	logger.debug(`Starting createDocument for resource: ${resource}`, {
		entity: EntityType.MONGODB,
		userId: requestContext.userId,
		payload,
	})

	await ensureTenantAccess(requestContext, resource, 'create')

	const tenantContext = getTenantContext(requestContext)

	logger.debug('Tenant context resolved for createDocument', {
		entity: EntityType.MONGODB,
		tenantId: tenantContext.tenantId,
		userId: requestContext.userId,
	})

	const documentToCreate = {
		...payload,
		tenantId: tenantContext.tenantId,
		createdBy: buildCreatedBy(requestContext, resource),
	}

	logger.debug(
		`Creating MongoDB document: ${JSON.stringify(documentToCreate)}`,
		{
			entity: EntityType.MONGODB,
		},
	)

	const created = await model.create(documentToCreate)

	logger.debug(
		`Created MongoDB document successfully: ${JSON.stringify(created)}`,
		{
			entity: EntityType.MONGODB,
			documentId: created.id,
		},
	)

	return { _id: created.id }
}

export const updateDocument = async (
	requestContext: RequestContext,
	resource: TenantResource,
	model: EntityModel,
	id: string,
	payload: Record<string, unknown>,
) => {
	await ensureTenantAccess(requestContext, resource, 'update')
	const tenantContext = getTenantContext(requestContext)

	const idField = RESOURCE_ID_FIELD[resource]
	const updatePayload = { ...payload }

	delete updatePayload.updatedBy

	const updated = await withTenantScope(
		model.findOneAndUpdate(
			{ [idField]: id },
			{
				$set: {
					...updatePayload,
					updatedBy: buildUpdatedBy(requestContext, resource),
				},
			},
			{ new: true, runValidators: true },
		),
		tenantContext.tenantId,
	).lean()

	if (!updated) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			`${resource} not found.`,
		)
	}

	return updated
}

export const deleteDocument = async (
	requestContext: RequestContext,
	resource: TenantResource,
	model: EntityModel,
	id: string,
) => {
	await ensureTenantAccess(requestContext, resource, 'delete')
	const { tenantId } = getTenantContext(requestContext)

	const idField = RESOURCE_ID_FIELD[resource]

	const deleted = await withTenantScope(
		model.findOneAndDelete({ [idField]: id }).lean(),
		tenantId,
	)

	if (!deleted) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_DELETE_ERROR,
			`${resource} not found.`,
		)
	}

	return deleted
}

export const deleteDocuments = async (
	requestContext: RequestContext,
	resource: TenantResource,
	model: EntityModel,
	{
		fieldName,
		fieldValues,
	}: {
		fieldName: string
		fieldValues: string[]
	},
) => {
	await ensureTenantAccess(requestContext, resource, 'delete')
	const { tenantId } = getTenantContext(requestContext)

	const valuesToDelete = Array.from(new Set(fieldValues))
	const deleted = await model
		.deleteMany({ [fieldName]: { $in: valuesToDelete } })
		.setOptions({ __tenantContext: { tenantId } })
		.exec()

	if (deleted.deletedCount === 0) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_DELETE_ERROR,
			`${resource} not found.`,
		)
	}

	return deleted
}
