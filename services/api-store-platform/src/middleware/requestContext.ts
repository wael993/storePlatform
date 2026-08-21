// import { Request, Response, NextFunction } from 'express'
import { UserRole } from '../shared/tenant'

interface Operation {
	fields: string[]
	accessLevel: string
}
interface Method {
	[prop: string]: Operation
}

interface Resources {
	[path: string]: Method
}

interface AuthorizedUser {
	userId: string
	tenantId: string
	tenantName: string
	firstName: string
	lastName: string
	email: string
	role: UserRole
	permissions: Resources
	// services: Service[]
	// businessPartner?: BusinessPartner
	// isInternal: boolean
}

interface RequestContext {
	authorization?: string
	cookie?: string
	userId?: string
	tenantId?: string
	tenantName?: string
	role?: UserRole
	user?: AuthorizedUser
}

export const getRequestContext = (req: any) => {
	const requestContext: RequestContext = {
		authorization: req.headers.authorization,
		cookie: req.headers.cookie,
		userId: req.user?.userId,
		tenantId: req.user?.tenantId,
		tenantName: req.user?.tenantName,
		role: req.user?.role,
		user: req.user,
	}

	req.context = requestContext
}
