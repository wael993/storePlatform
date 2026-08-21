import { UserRole } from '../tenant'

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
	// isInternal: boolean
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
type HttpMethods = 'GET' | 'DELETE' | 'POST' | 'PUT' | 'PATCH'

interface FieldValueFilter {
	fieldName: string
	values: FieldValueFilterValueType[]
	exceptionValues?: FieldValueFilterValueType[]
}

type FieldValueFilterValueType = string | boolean | number | null
