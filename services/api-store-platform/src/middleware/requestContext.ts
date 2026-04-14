import { Request, Response, NextFunction } from 'express'

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

interface AuthorizedUserRole {
	_id: string
	name: string
	resources: Record<string, any>
	include: string[]
	frontendResources: Record<string, any>
	serviceIds: string[]
	rolesIncluded: string[]
}

interface AuthorizedUser {
	userId: string
	firstName: string
	lastName: string
	email: string
	role: AuthorizedUserRole
	permissions: Resources
	// services: Service[]
	// businessPartner?: BusinessPartner
	isInternal: boolean
}

interface RequestContext {
	authorization?: string
	cookie?: string
	userId?: string
	user?: AuthorizedUser
	userVendorId?: string
}

export const getRequestContext = (req: any) => {
	const requestContext: RequestContext = {
		authorization: req.headers.authorization,
		cookie: req.headers.cookie,
		userId: req.user?.userId,
		user: req.user,
	}

	req.context = requestContext
}
