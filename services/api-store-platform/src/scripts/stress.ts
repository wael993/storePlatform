/**
 * Concurrency + replay checks against a running API (local or staging), end to end
 * over HTTP. Creates its own products; touches existing data only by switching
 * `allowOversell` off for the stock test and restoring it afterwards.
 *
 *   STRESS_BASE=http://localhost:3001 STRESS_EMAIL=… STRESS_PASSWORD=… \
 *   [STRESS_DATABASE_URL=postgres://…] npm run stress
 *
 * STRESS_DATABASE_URL (optional): also checks cash balance == ledger and no negative
 * stock for the tenant. Exit code 1 when any check fails.
 */
import { randomUUID } from 'crypto'
import { Pool } from 'pg'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const env = (name: string) => {
	const value = process.env[name]

	if (!value) throw new Error(`${name} is not set`)

	return value
}

const BASE = `${env('STRESS_BASE').replace(/\/$/, '')}/api/data`
const PRICE = 10
const failures: string[] = []

const check = (name: string, ok: boolean, detail: string) => {
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${detail}`)

	if (!ok) failures.push(name)
}

let headers: Record<string, string> = { 'content-type': 'application/json' }

const call = async (method: string, path: string, body?: unknown) => {
	const response = await fetch(`${BASE}${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
		signal: AbortSignal.timeout(30_000), // a hang is a failure, not a wait
	})
	const text = await response.text()

	return {
		status: response.status,
		body: text ? (JSON.parse(text) as Json) : {},
	}
}

const ok = async (method: string, path: string, body?: unknown) => {
	const result = await call(method, path, body)

	if (result.status >= 300) {
		throw new Error(
			`${method} ${path} → ${result.status} ${JSON.stringify(result.body)}`,
		)
	}

	return result.body
}

const round = (n: number) => Math.round(n * 1e6) / 1e6

const main = async () => {
	const login = await ok('POST', '/login', {
		email: env('STRESS_EMAIL'),
		password: env('STRESS_PASSWORD'),
	})

	headers = { ...headers, authorization: `Bearer ${login.accessToken}` }

	const warehouseId = (await ok('GET', '/warehouses')).data[0]
		.warehouseId as string

	headers['x-warehouse-scope'] = warehouseId

	const primary = (await ok('GET', '/currency-settings'))
		.primaryCurrency as Json
	const currencyId = primary.currencyId as string
	const run = Date.now().toString().slice(-8)

	console.log(`tenant ${login.tenantId}, warehouse ${warehouseId}, run ${run}`)

	const newProduct = async (label: string, quantity: number) => {
		const productId = randomUUID()

		await ok('POST', '/product', {
			productId,
			name: `stress ${label} ${run}`,
			barcode: `9${run}${Math.floor(Math.random() * 1e5)}`,
			price: { retailPrice: PRICE, purchasePrice: 5, currency: currencyId },
			status: 'active',
			quantity,
			warehouseId,
		})

		return productId
	}

	const stock = async (productId: string) =>
		Number(
			(await ok('GET', `/inventory/by-product/${productId}`)).data.find(
				(row: Json) => row.warehouseId === warehouseId,
			)?.quantity ?? 0,
		)

	const cash = async () =>
		Number(
			(await ok('GET', '/cash-accounts/balances')).accounts.find(
				(a: Json) => a.type === 'daily_cash',
			)?.balances?.[currencyId] ?? 0,
		)

	/** Body like the web app's buildInvoiceRequestBody (one currency, cash). */
	const sale = (
		productId: string,
		quantity: number,
		paid: number,
		invoiceId = randomUUID(),
	) => {
		const amount = PRICE * quantity

		return {
			invoiceId,
			clientMutationId: randomUUID(),
			paymentType: 'cash',
			items: [
				{
					productId,
					name: 'stress',
					quantity,
					unitPrice: PRICE,
					lineTotal: amount,
				},
			],
			status: paid >= amount ? 'paid' : 'partial',
			paymentStatus: paid >= amount ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
			invoiceCurrencyId: currencyId,
			cashAccountType: 'daily_cash',
			tenders: paid > 0 ? [{ currencyId, tenderedAmount: paid }] : [],
			currencyAmounts: [
				{
					currencyId,
					name: primary.name,
					internalCode: primary.internalCode,
					exchangeRate: 1,
					isPrimary: true,
					amount,
					paidAmount: paid,
					remainingAmount: amount - paid,
					subtotal: amount,
					tax: 0,
					discount: 0,
				},
			],
			warehouseId,
			issuedAt: new Date().toISOString(),
		}
	}

	// 1. More parallel sales than stock (oversell off): exactly `stock` succeed, never below 0
	const settings = await ok('GET', '/invoice-settings')
	const oversell = settings.allowOversell === true

	if (oversell) await ok('PATCH', '/invoice-settings', { allowOversell: false })

	try {
		const STOCK = 5
		const BUYERS = 12
		const productId = await newProduct('race', STOCK)
		const cashBefore = await cash()
		const started = Date.now()
		const results = await Promise.allSettled(
			Array.from({ length: BUYERS }, () =>
				call('POST', '/selling-invoices', sale(productId, 1, PRICE)),
			),
		)
		const seconds = (Date.now() - started) / 1000
		const answered = results
			.filter(r => r.status === 'fulfilled')
			.map(r => (r as PromiseFulfilledResult<{ status: number }>).value)
		const sold = answered.filter(r => r.status < 300).length

		check(
			'parallel sales: every request answered',
			answered.length === BUYERS,
			`${answered.length}/${BUYERS} in ${seconds.toFixed(1)}s`,
		)

		check(
			'parallel sales: only available stock sold',
			sold === STOCK,
			`${sold} sold of ${STOCK}`,
		)

		check(
			'parallel sales: stock ends at 0',
			(await stock(productId)) === 0,
			`stock ${await stock(productId)}`,
		)

		check(
			'parallel sales: cash = sold × price',
			round((await cash()) - cashBefore) === sold * PRICE,
			`cash +${round((await cash()) - cashBefore)}`,
		)
	} finally {
		if (oversell)
			await ok('PATCH', '/invoice-settings', { allowOversell: true })
	}

	// 2. Edits back and forth end where one sale would
	{
		const productId = await newProduct('edit', 100)
		const cashBefore = await cash()
		const body = sale(productId, 2, 20)
		const invoiceId =
			(await ok('POST', '/selling-invoices', body)).invoiceId ?? body.invoiceId

		for (const [quantity, paid] of [
			[2, 10],
			[2, 20],
			[3, 20],
			[2, 20],
		]) {
			const edit: Json = sale(productId, quantity, paid, invoiceId)

			delete edit.invoiceId // a PATCH body carries no ids
			delete edit.clientMutationId
			await ok('PATCH', `/selling-invoices/${invoiceId}`, edit)
		}

		check(
			'edits back and forth: stock',
			(await stock(productId)) === 98,
			`stock ${await stock(productId)} (expected 98)`,
		)

		check(
			'edits back and forth: cash',
			round((await cash()) - cashBefore) === 20,
			`cash +${round((await cash()) - cashBefore)} (expected 20)`,
		)

		// 3. Two deletes at once: one wins, stock and cash return once
		const deletes = await Promise.all([
			call('DELETE', `/selling-invoices/${invoiceId}`),
			call('DELETE', `/selling-invoices/${invoiceId}`),
		])
		const won = deletes.filter(r => r.status < 300).length

		check(
			'double delete: exactly one succeeds',
			won === 1,
			`statuses ${deletes.map(r => r.status).join(', ')}`,
		)

		check(
			'double delete: stock back once',
			(await stock(productId)) === 100,
			`stock ${await stock(productId)} (expected 100)`,
		)

		check(
			'double delete: cash back once',
			round((await cash()) - cashBefore) === 0,
			`cash ${round((await cash()) - cashBefore)} (expected 0)`,
		)
	}

	// 4. Offline batch pushed twice, then twice at once: each sale exists once
	{
		const productId = await newProduct('sync', 100)
		const cashBefore = await cash()
		const entries = [1, 2, 3].map(quantity => {
			const body = sale(productId, quantity, PRICE * quantity)

			return {
				clientMutationId: body.clientMutationId,
				entity: 'invoice',
				operation: 'create',
				url: '/selling-invoices',
				method: 'POST',
				payload: body,
			}
		})
		const push = () => call('POST', '/sync/push', { entries })

		await push()
		await push()
		await Promise.all([push(), push()])

		check(
			'offline replay: stock once',
			(await stock(productId)) === 94,
			`stock ${await stock(productId)} (expected 94)`,
		)

		check(
			'offline replay: cash once',
			round((await cash()) - cashBefore) === 60,
			`cash +${round((await cash()) - cashBefore)} (expected 60)`,
		)
	}

	// 5. Database invariants for this tenant (optional)
	if (process.env.STRESS_DATABASE_URL) {
		const pool = new Pool({ connectionString: process.env.STRESS_DATABASE_URL })
		const tenantId = login.tenantId as string

		try {
			const drift = await pool.query(
				`select count(*)::int as n from (
				   select cash_account_id, currency_id, sum(amount) as total
				   from store.cash_ledger_entries where tenant_id = $1 group by 1, 2) l
				 full join (select * from store.cash_account_balances where tenant_id = $1) b
				   on b.cash_account_id = l.cash_account_id and b.currency_id = l.currency_id
				 where abs(coalesce(l.total, 0) - coalesce(b.amount, 0)) > 1e-6`,
				[tenantId],
			)
			const negative = await pool.query(
				`select count(*)::int as n from store.inventories i
				 join store.products p on p.tenant_id = i.tenant_id and p.product_id = i.product_id
				 where i.tenant_id = $1 and i.quantity < 0 and p.name like $2`,
				[tenantId, `stress % ${run}`],
			)

			check(
				'db: cash balance = ledger',
				drift.rows[0].n === 0,
				`${drift.rows[0].n} account/currency pairs differ`,
			)

			check(
				"db: no negative stock on this run's products",
				negative.rows[0].n === 0,
				`${negative.rows[0].n} rows`,
			)
		} finally {
			await pool.end()
		}
	}

	console.log(
		failures.length
			? `\n[stress] ${failures.length} check(s) failed`
			: '\n[stress] all checks passed',
	)

	process.exit(failures.length ? 1 : 0)
}

main().catch(error => {
	console.error(
		'[stress] error:',
		error instanceof Error ? error.message : error,
	)

	process.exit(1)
})
