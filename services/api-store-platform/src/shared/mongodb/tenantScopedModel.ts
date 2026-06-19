import mongoose, { Query, Schema } from 'mongoose'

type TenantQueryOptions = {
	__tenantContext?: {
		tenantId: string
	}
}

type TenantScopedQuery<ResultType, DocType> = Query<ResultType, DocType> & {
	setOptions(options: TenantQueryOptions): Query<ResultType, DocType>
}

const TENANT_QUERY_METHODS = [
	'countDocuments',
	'deleteMany',
	'deleteOne',
	'find',
	'findOne',
	'findOneAndDelete',
	'findOneAndReplace',
	'findOneAndUpdate',
	'replaceOne',
	'updateMany',
	'updateOne',
] as const

const attachTenantFilter = function <ResultType, DocType>(
	this: TenantScopedQuery<ResultType, DocType>,
	next: () => void,
) {
	const options = this.getOptions() as TenantQueryOptions
	const tenantIdFromContext = options.__tenantContext?.tenantId
	const filter = this.getFilter() as Record<string, unknown>
	const tenantIdFromFilter =
		typeof filter?.tenantId === 'string' ? filter.tenantId : undefined
	const tenantId = tenantIdFromContext || tenantIdFromFilter

	if (!tenantId) {
		throw new Error('Tenant-scoped query is missing tenant context.')
	}

	if (!tenantIdFromFilter) {
		this.where({ tenantId })
	}

	next()
}

export const tenantScopedSchema = <T extends mongoose.Document>(
	schema: Schema<T>,
) => {
	schema.add({
		tenantId: {
			type: String,
			required: [true, 'tenantId is required'],
			index: true,
			trim: true,
		},
	} as any)

	for (const method of TENANT_QUERY_METHODS) {
		schema.pre(method, attachTenantFilter)
	}
}

export const withTenantScope = <ResultType, DocType>(
	query: TenantScopedQuery<ResultType, DocType>,
	tenantId: string,
) => query.setOptions({ __tenantContext: { tenantId } })
