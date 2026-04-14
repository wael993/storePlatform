interface AuthorizedUser {
	userId: string
	firstName: string
	lastName: string
	email: string
	role: AuthorizedUserRole
	permissions: Resources
	// services: Service[]
	isInternal: boolean
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
export interface Resources {
	[resourcePath: string]: {
		GET?: Operation
		POST?: Operation
		PATCH?: Operation
		PUT?: Operation
		DELETE?: Operation
	}
}

interface Operation {
	fields: string[]
	accessLevel: AccessLevel
	fieldValueFilters?: FieldValueFilter[][]
}

type AccessLevel = 'GLOBAL' | 'SERVICE' | 'COMPANY' | 'SELF'

interface FieldValueFilter {
	fieldName: string
	values: FieldValueFilterValueType[]
	exceptionValues?: FieldValueFilterValueType[]
}

type FieldValueFilterValueType = string | boolean | number | null
