/**
 * Response diff between two running API builds (e.g. Mongo build vs Postgres
 * build) over the same data. Only calls endpoints that do not write.
 *
 *   DIFF_A=http://localhost:3001 DIFF_B=http://localhost:3002 \
 *   DIFF_EMAIL=… DIFF_PASSWORD=… [DIFF_SCOPE=warehouseId,…] npm run api:diff
 *
 * Exits non-zero on any difference. "order only" = same items, different array order.
 */
import { isDeepStrictEqual } from 'util'

import {
	dropAddedKeys,
	firstDiff,
	normalize,
	roundFloats,
	sortDeep,
} from '../db/etl/compare'

type Json = unknown

/**
 * Group 1 (money + stock) and group 2 (catalog, parties, master data) read endpoints. `id` = field in the list items used
 * for the detail call; `items` = key holding the list (default `data`).
 * Not here: `/sync/bootstrap` allocates offline number blocks on every call, so it is not a read.
 */
const ENDPOINTS: Array<{
	list: string
	detail?: string
	id?: string
	items?: string
}> = [
	{
		list: '/selling-invoices',
		detail: '/selling-invoices/:id',
		id: 'invoiceId',
		items: 'invoices',
	},
	{
		list: '/buying-invoices',
		detail: '/buying-invoices/:id',
		id: 'buyingInvoiceId',
		items: 'invoices',
	},
	{ list: '/inventory' },
	{
		list: '/inventory/warehouse-transfers',
		detail: '/inventory/warehouse-transfers/:id',
		id: 'referenceId',
	},
	{ list: '/cash-accounts/balances' },
	{ list: '/cash-accounts/ledger' },
	{ list: '/daily-actions', detail: '/daily-actions/:id', id: 'actionId' },
	{ list: '/daily-actions/filter-values' },
	{ list: '/sync/changes?since=1970-01-01T00:00:00.000Z' },
	// group 2: catalog, parties, master data
	{
		list: '/products',
		detail: '/products/:id',
		id: 'productId',
		items: 'products',
	},
	{ list: '/products?search=a' },
	{ list: '/products/catalog' },
	{ list: '/filter-values' },
	{ list: '/categories' },
	{ list: '/brands' },
	{ list: '/units' },
	{ list: '/shelves' },
	{ list: '/warehouses' },
	{ list: '/currencies' },
	{ list: '/currency-settings' },
	{ list: '/customers', detail: '/customers/:id', id: 'customerId' },
	{ list: '/suppliers', detail: '/suppliers/:id', id: 'supplierId' },
	{ list: '/partners', detail: '/partners/:id', id: 'partnerId' },
	{ list: '/projects', detail: '/projects/:id', id: 'projectId' },
	{ list: '/employees', detail: '/employees/:id', id: 'employeeId' },
	{ list: '/expenses', detail: '/expenses/:id', id: 'expenseId' },
]

/**
 * Ignored keys: values that differ per request by design, and Mongoose's `__v`
 * (internal version counter, read by nothing; Postgres has none).
 */
const VOLATILE_KEYS = new Set(['serverTime', 'generatedAt', 'requestId', '__v'])
const ADDED_KEYS = new Set(['createdAt', 'updatedAt'])
const DETAIL_SAMPLES = 5

/** Product `price._id` (Mongoose subdocument id) is not kept in Postgres; nothing reads it. */
const withoutPriceId = (value: Json): Json =>
	JSON.parse(
		JSON.stringify(value, (key, item) =>
			key === 'price' &&
			item &&
			typeof item === 'object' &&
			!Array.isArray(item)
				? Object.fromEntries(Object.entries(item).filter(([k]) => k !== '_id'))
				: item,
		),
	)

const env = (name: string) => {
	const value = process.env[name]

	if (!value) {
		throw new Error(`${name} is not set`)
	}

	return value
}

const login = async (base: string) => {
	const response = await fetch(`${base}/api/data/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			email: env('DIFF_EMAIL'),
			password: env('DIFF_PASSWORD'),
		}),
	})
	const body = (await response.json()) as { accessToken?: string }

	if (!response.ok || !body.accessToken) {
		throw new Error(`login failed on ${base}: ${response.status}`)
	}

	return body.accessToken
}

const get = async (base: string, token: string, path: string) => {
	const headers: Record<string, string> = { authorization: `Bearer ${token}` }

	if (process.env.DIFF_SCOPE) {
		headers['x-warehouse-scope'] = process.env.DIFF_SCOPE
	}

	const response = await fetch(`${base}/api/data${path}`, { headers })

	return {
		status: response.status,
		body: (await response.json().catch(() => null)) as Json,
	}
}

const itemsOf = (body: Json, key = 'data'): Array<Record<string, Json>> => {
	const data = (body as Record<string, Json>)?.[key] ?? body

	return Array.isArray(data) ? (data as Array<Record<string, Json>>) : []
}

const main = async () => {
	const [a, b] = [env('DIFF_A'), env('DIFF_B')]
	const [tokenA, tokenB] = await Promise.all([login(a), login(b)])
	let failed = 0

	const compare = async (path: string) => {
		const [ra, rb] = await Promise.all([
			get(a, tokenA, path),
			get(b, tokenB, path),
		])
		const na = roundFloats(normalize(withoutPriceId(ra), VOLATILE_KEYS))
		// Accepted: timestamps filled where Mongo had none; product price._id not kept.
		const nb = dropAddedKeys(
			na,
			roundFloats(normalize(rb, VOLATILE_KEYS)),
			ADDED_KEYS,
		)

		if (isDeepStrictEqual(na, nb)) {
			console.log(`same        ${path} (${ra.status})`)

			return ra.body
		}

		failed += 1
		const orderOnly = isDeepStrictEqual(sortDeep(na), sortDeep(nb))

		console.log(
			`${orderOnly ? 'order only' : 'DIFF      '}  ${path}\n            ${firstDiff(na, nb)}`,
		)

		return ra.body
	}

	for (const endpoint of ENDPOINTS) {
		const body = await compare(endpoint.list)

		if (!endpoint.detail || !endpoint.id) {
			continue
		}

		const ids = itemsOf(body, endpoint.items)
			.map(item => item[endpoint.id!])
			.filter((id): id is string => typeof id === 'string')
			.slice(0, DETAIL_SAMPLES)

		if (!ids.length) {
			console.log(`no ids      ${endpoint.list} → ${endpoint.detail} skipped`)
		}

		for (const id of ids) {
			await compare(endpoint.detail.replace(':id', encodeURIComponent(id)))
		}
	}

	if (failed) {
		throw new Error(`${failed} endpoint(s) differ`)
	}

	console.log('[api-diff] all responses equal')
}

main().catch(error => {
	console.error('[api-diff] failed:', (error as Error).message)
	process.exit(1)
})
