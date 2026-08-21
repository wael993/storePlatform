import User, { IUser } from '../../models/User'
import RefreshToken from '../../models/RefreshToken'
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

export const updateTenantUser = async (
	userId: string,
	requestBody: UpdateTenantUserRequestBody,
	requestContext: RequestContext,
): Promise<IUser> => {
	await ensureTenantAccess(requestContext, 'users', 'update')
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

	// if (typeof requestBody.isInternal === 'boolean') {
	// 	updates['user.isInternal'] = requestBody.isInternal
	// }
	if (requestBody.role) {
		assertAssignableTenantRole(requestBody.role)
		updates.role = requestBody.role
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
	await ensureTenantAccess(requestContext, 'users', 'delete')
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

	if (String(targetUser._id) === requestContext.userId) {
		throw new BusinessLogicError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'You cannot delete your own account.',
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
