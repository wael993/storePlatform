import { Model } from 'mongoose'
import { withTenantScope } from './tenantScopedModel'
import { RequestContext } from '../types'
import { TenantResource, ensureTenantAccess, getTenantContext } from '../tenant'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import logger, { EntityType } from '../logger/logger'
import { SortOrder } from 'mongoose'

type Sort = Record<string, SortOrder>

export type EntityModel = Model<any>

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
		createdBy: requestContext.userId,
		updatedBy: requestContext.userId,
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

	const updated = await withTenantScope(
		model.findOneAndUpdate(
			{ id: id },
			{ $set: { ...payload, updatedBy: requestContext.userId } },
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

	const deleted = await withTenantScope(
		model.findOneAndDelete({ _id: id }).lean(),
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
