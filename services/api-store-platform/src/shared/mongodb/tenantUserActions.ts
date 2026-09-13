import User, { IUser } from '../../models/User'
import RefreshToken from '../../models/RefreshToken'
import { Warehouse } from '../../models/Warehaus'
import { RequestContext, UpdateTenantUserRequestBody } from '../types'
import {
	assertAssignableTenantRole,
	ensureTenantAccess,
	getTenantContext,
} from '../tenant'
import { withTenantScope } from './tenantScopedModel'
import {
	AuthorizationError,
	BusinessLogicError,
} from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import { COLLECTION_NAMES } from '../general'
import { isUuidV4 } from '../uuid'

export const updateTenantUser = async (
	userId: string,
	requestBody: UpdateTenantUserRequestBody,
	requestContext: RequestContext,
): Promise<IUser> => {
	await ensureTenantAccess(requestContext, COLLECTION_NAMES.USERS)
	const tenantContext = getTenantContext(requestContext)

	if (Object.prototype.hasOwnProperty.call(requestBody, 'tenantId')) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Tenant assignment cannot be changed.',
		)
	}

	const updates: Record<string, unknown> = {}

	if (requestBody.firstName) {
		updates['user.firstName'] = requestBody.firstName
	}

	if (requestBody.lastName) {
		updates['user.lastName'] = requestBody.lastName
	}

	if (requestBody.role) {
		assertAssignableTenantRole(requestBody.role)
		if (requestBody.role === 'owner' && requestContext.role !== 'owner') {
			throw new AuthorizationError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Only owner can assign the owner role.',
			)
		}

		const targetUser = (await withTenantScope(
			User.findOne({ userId }).lean(),
			tenantContext.tenantId,
		)) as Pick<IUser, 'userId' | 'role'> | null

		if (
			targetUser?.role === 'owner' &&
			targetUser.userId === requestContext.user?.userId &&
			requestBody.role !== 'owner'
		) {
			throw new AuthorizationError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Owner cannot change their own role.',
			)
		}

		updates.role = requestBody.role
	}

	if (requestBody.warehouseIds !== undefined) {
		if (requestContext.role !== 'owner') {
			throw new AuthorizationError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Only owner can assign warehouse access.',
			)
		}

		const uniqueIds = [
			...new Set(
				requestBody.warehouseIds
					.map(id => id?.trim())
					.filter((id): id is string => Boolean(id)),
			),
		]

		if (uniqueIds.some(id => !isUuidV4(id))) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'warehouseIds must be UUID v4 values.',
			)
		}

		if (uniqueIds.length > 0) {
			const warehouses = await withTenantScope(
				Warehouse.find({ warehouseId: { $in: uniqueIds } }).lean(),
				tenantContext.tenantId,
			)
			const found = new Set(
				warehouses.map(warehouse => warehouse.warehouseId as string),
			)

			if (uniqueIds.some(id => !found.has(id))) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'One or more warehouseIds are invalid for this tenant.',
				)
			}
		}

		updates.warehouseIds = uniqueIds
	}

	if (requestBody.firstName || requestBody.lastName) {
		const firstName = requestBody.firstName || ''
		const lastName = requestBody.lastName || ''

		updates.displayName = `${firstName} ${lastName}`.trim()
	}

	if (Object.keys(updates).length === 0) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
			'No fields provided for update.',
		)
	}

	const updated = (await withTenantScope(
		User.findOneAndUpdate(
			{ userId },
			{ $set: updates },
			{
				new: true,
				runValidators: true,
				projection: { password: 0, tokenVersion: 0 },
			},
		),
		tenantContext.tenantId,
	).lean()) as IUser | null

	if (!updated) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'User not found.',
		)
	}

	return updated
}

export const deleteTenantUser = async (
	userId: string,
	requestContext: RequestContext,
): Promise<void> => {
	await ensureTenantAccess(requestContext, COLLECTION_NAMES.USERS)
	const tenantContext = getTenantContext(requestContext)

	const targetUser = (await withTenantScope(
		User.findOne({ userId }),
		tenantContext.tenantId,
	).lean()) as IUser | null

	if (!targetUser) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_DELETE_ERROR,
			'User not found.',
		)
	}

	if (
		targetUser.userId === requestContext.user?.userId ||
		targetUser.userId === requestContext.userId
	) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'You cannot delete your own account.',
		)
	}

	if (targetUser.role === 'owner') {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Owner accounts cannot be deleted.',
		)
	}

	const deleted = (await withTenantScope(
		User.findOneAndDelete({ userId }),
		tenantContext.tenantId,
	).lean()) as IUser | null

	if (!deleted) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_DELETE_ERROR,
			'User not found.',
		)
	}

	await RefreshToken.deleteMany({
		userId: deleted._id,
		tenantId: tenantContext.tenantId,
	})
}
