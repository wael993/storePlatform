import { RequestContext } from './types'
import { resolveWarehouseScope } from './warehouseAccess'

type RequestLike = {
	headers: {
		authorization?: string
		cookie?: string
		['x-warehouse-scope']?: string | string[]
	}
	user?: RequestContext['user'] & {
		userId?: string
		tenantId?: string
		tenantName?: string
		role?: RequestContext['role']
	}
	allowedFields?: string[]
	see?: string[]
}

export const buildRequestContext = (request: RequestLike): RequestContext => {
	const base: RequestContext = {
		authorization: request.headers.authorization,
		cookie: request.headers.cookie,
		userId: request.user?.userId,
		tenantId: request.user?.tenantId,
		tenantName: request.user?.tenantName,
		role: request.user?.role,
		user: request.user,
		allowedFields: request.allowedFields || [],
		see: request.see || [],
	}

	return {
		...base,
		warehouseScope: resolveWarehouseScope(
			base,
			request.headers['x-warehouse-scope'],
		),
	}
}
