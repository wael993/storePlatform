import { Model } from 'mongoose'
import { withTenantScope } from './tenantScopedModel'
import { RequestContext } from '../types'
import { TenantResource, ensureTenantAccess, getTenantContext } from '../tenant'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'

export type EntityModel = Model<any>

export const listDocuments = async (
	requestContext: RequestContext,
	resource: TenantResource,
	model: EntityModel,
	sort: Record<string, 1 | -1>,
) => {
	await ensureTenantAccess(requestContext, resource, 'read')
	const tenantContext = getTenantContext(requestContext)

	return withTenantScope(model.find(), tenantContext.tenantId).sort(sort).lean()
}

export const getDocumentByField = async (
	requestContext: RequestContext,
	resource: TenantResource,
	model: EntityModel,
	fieldName: string,
	fieldValue: string,
) => {
	await ensureTenantAccess(requestContext, resource, 'read')
	const tenantContext = getTenantContext(requestContext)

	return withTenantScope(
		model.findOne({ [fieldName]: fieldValue }),
		tenantContext.tenantId,
	).lean()
}

export const createDocument = async (
	requestContext: RequestContext,
	resource: TenantResource,
	model: EntityModel,
	payload: Record<string, unknown>,
): Promise<{ _id: string }> => {
	await ensureTenantAccess(requestContext, resource, 'create')
	const tenantContext = getTenantContext(requestContext)
	console.log('🚀 ~ createDocument ~ tenantContext:', tenantContext)

	const created = await model.create({
		...payload,
		tenantId: tenantContext.tenantId,
		createdBy: requestContext.userId,
		updatedBy: requestContext.userId,
	})

	return { _id: created.id }
}

export const updateDocument = async (
	requestContext: RequestContext,
	resource: TenantResource,
	model: EntityModel,
	fieldName: string,
	fieldValue: string,
	payload: Record<string, unknown>,
) => {
	await ensureTenantAccess(requestContext, resource, 'update')
	const tenantContext = getTenantContext(requestContext)

	const updated = await withTenantScope(
		model.findOneAndUpdate(
			{ [fieldName]: fieldValue },
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
	fieldName: string,
	fieldValue: string,
) => {
	await ensureTenantAccess(requestContext, resource, 'delete')
	const tenantContext = getTenantContext(requestContext)

	const deleted = await withTenantScope(
		model.findOneAndDelete({ [fieldName]: fieldValue }),
		tenantContext.tenantId,
	).lean()

	if (!deleted) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_DELETE_ERROR,
			`${resource} not found.`,
		)
	}

	return deleted
}
