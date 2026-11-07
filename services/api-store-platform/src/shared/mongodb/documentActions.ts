import { Model } from 'mongoose'
import { withTenantScope } from './tenantScopedModel'
import { RequestContext } from '../types'
import { TenantResource, ensureTenantAccess, getTenantContext } from '../tenant'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import logger, { EntityType } from '../logger/logger'
import { SortOrder } from 'mongoose'
import { COLLECTION_NAMES } from '../general'
import { deleteDocs, insertDoc, updateDoc } from '../../db/docs'
import { whereOf, pgDeleteMany, pgFind, pgFindOne } from '../../db/mongoQuery'
import { asMongoSession, asTx, isPgModel, Session } from '../../db/ownership'
import { specForModel } from '../../db/docs'

type Sort = Record<string, SortOrder>

export type EntityModel = Model<any>

const STRING_AUDIT_RESOURCES = new Set<TenantResource>([
	COLLECTION_NAMES.REPORTS,
])

const RESOURCE_ID_FIELD: Record<TenantResource, string> = {
	[COLLECTION_NAMES.PRODUCTS]: 'productId',
	[COLLECTION_NAMES.CATEGORIES]: 'categoryId',
	[COLLECTION_NAMES.PROJECTS]: 'projectId',
	[COLLECTION_NAMES.INVOICES]: 'invoiceId',
	[COLLECTION_NAMES.BUYING_INVOICES]: 'buyingInvoiceId',
	[COLLECTION_NAMES.INVENTORY]: 'inventoryId',
	[COLLECTION_NAMES.REPORTS]: 'reportId',
	[COLLECTION_NAMES.DAILY_ACTIONS]: 'actionId',
	[COLLECTION_NAMES.SUPPLIERS]: 'supplierId',
	[COLLECTION_NAMES.CUSTOMERS]: 'customerId',
	[COLLECTION_NAMES.EXPENSES]: 'expenseId',
	[COLLECTION_NAMES.CURRENCIES]: 'currencyId',
	[COLLECTION_NAMES.UNITS]: 'unitId',
	[COLLECTION_NAMES.PARTNERS]: 'partnerId',
	[COLLECTION_NAMES.BRANDS]: 'brandId',
	[COLLECTION_NAMES.SHELVES]: 'shelfId',
	[COLLECTION_NAMES.WAREHOUSES]: 'warehouseId',
	[COLLECTION_NAMES.STOCK_MOVINGS]: 'stockMovingId',
	[COLLECTION_NAMES.SYNC_MUTATIONS]: 'clientMutationId',
	[COLLECTION_NAMES.USERS]: '_id',
	[COLLECTION_NAMES.TENANTS]: '_id',
	[COLLECTION_NAMES.EMPLOYEES]: 'employeeId',
	[COLLECTION_NAMES.LABEL_TEMPLATES]: 'templateId',
}

export const omitIdentityFields = (payload: Record<string, unknown>) => {
	const next = { ...payload }

	delete next.tenantId
	delete next.createdBy
	delete next.updatedBy

	return next
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
	await ensureTenantAccess(requestContext, collectionName)
	const tenantContext = getTenantContext(requestContext)

	if (isPgModel(model)) {
		return (await pgFind(model, tenantContext.tenantId, {}, { sort })) as T[]
	}

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
	session?: Session,
): Promise<T | null> => {
	await ensureTenantAccess(requestContext, resource)
	const tenantContext = getTenantContext(requestContext)

	if (isPgModel(model)) {
		return (await pgFindOne(
			model,
			tenantContext.tenantId,
			{ [fieldName]: fieldValue },
			{ db: asTx(session) },
		)) as T | null
	}

	const mongoSession = asMongoSession(session)
	const query = withTenantScope(
		model.findOne({ [fieldName]: fieldValue }),
		tenantContext.tenantId,
	)

	return (mongoSession ? query.session(mongoSession) : query).lean<T>().exec()
}

export const createDocument = async (
	requestContext: RequestContext,
	resource: TenantResource,
	model: EntityModel,
	payload: Record<string, unknown>,
	session?: Session,
): Promise<{ _id: string }> => {
	logger.debug(`Starting createDocument for resource: ${resource}`, {
		entity: EntityType.MONGODB,
		userId: requestContext.userId,
		payload,
	})

	await ensureTenantAccess(requestContext, resource)

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

	if (isPgModel(model)) {
		const created = await insertDoc(model, documentToCreate, asTx(session))

		return { _id: String(created._id) }
	}

	const created = await new model(documentToCreate).save({
		session: asMongoSession(session),
	})

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
	session?: Session,
) => {
	await ensureTenantAccess(requestContext, resource)
	const tenantContext = getTenantContext(requestContext)

	const idField = RESOURCE_ID_FIELD[resource]
	const updatePayload = omitIdentityFields(payload)

	if (isPgModel(model)) {
		const updated = await updateDoc(
			model,
			tenantContext.tenantId,
			whereOf(specForModel(model).table, { [idField]: id }),
			{
				...updatePayload,
				tenantId: tenantContext.tenantId,
				updatedBy: buildUpdatedBy(requestContext, resource),
			},
			asTx(session),
		)

		if (!updated) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				`${resource} not found.`,
			)
		}

		return updated
	}

	const mongoSession = asMongoSession(session)

	const query = withTenantScope(
		model.findOneAndUpdate(
			{ [idField]: id },
			{
				$set: {
					...updatePayload,
					tenantId: tenantContext.tenantId,
					updatedBy: buildUpdatedBy(requestContext, resource),
				},
			},
			{ new: true, runValidators: true },
		),
		tenantContext.tenantId,
	)

	const updated = await (
		mongoSession ? query.session(mongoSession) : query
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
	await ensureTenantAccess(requestContext, resource)
	const { tenantId } = getTenantContext(requestContext)

	const idField = RESOURCE_ID_FIELD[resource]

	if (isPgModel(model)) {
		// Locks then deletes: of two parallel deletes, the second finds nothing (like findOneAndDelete).
		const table = specForModel(model).table
		const [deleted] = await deleteDocs(
			table,
			tenantId,
			whereOf(table, { [idField]: id }),
		)

		if (!deleted) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_DELETE_ERROR,
				`${resource} not found.`,
			)
		}

		return deleted
	}

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
	await ensureTenantAccess(requestContext, resource)
	const { tenantId } = getTenantContext(requestContext)

	const valuesToDelete = Array.from(new Set(fieldValues))
	const deleted = isPgModel(model)
		? await pgDeleteMany(model, tenantId, {
				[fieldName]: { $in: valuesToDelete },
			})
		: await model
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
