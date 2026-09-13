/**
 * WH-REL-2 API smoke (non-destructive).
 * Does not post invoices or move stock.
 * Usage: SMOKE_EMAIL=user@app.com SMOKE_PASSWORD='…'
 * to run this script, run: node scripts/wh-rel-2-smoke.mjs
 */
const base = process.env.SMOKE_API || 'http://localhost:3001/api/data'
const email = process.env.SMOKE_EMAIL
const password = process.env.SMOKE_PASSWORD

if (!email || !password) {
	console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD')
	process.exit(2)
}

const results = []

const record = (name, ok, detail) => {
	results.push({ name, ok, detail })
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const request = async (token, path, { method = 'GET', body, scope } = {}) => {
	const headers = { 'Content-Type': 'application/json' }
	if (token) headers.Authorization = `Bearer ${token}`
	if (scope !== undefined) headers['x-warehouse-scope'] = scope
	const response = await fetch(`${base}/${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	})
	const text = await response.text()
	let json
	try {
		json = JSON.parse(text)
	} catch {
		json = { raw: text.slice(0, 120) }
	}
	return { status: response.status, json }
}

const login = async () => {
	const { status, json } = await request(null, 'login', {
		method: 'POST',
		body: { email, password },
	})
	if (status >= 400 || !json.accessToken) {
		record('login', false, `status ${status} ${json.message || ''}`)
		return null
	}
	record('login', true, json.user?.role || json.role || '')
	return json.accessToken
}

const main = async () => {
	const token = await login()
	if (!token) {
		process.exit(1)
	}

	const warehousesRes = await request(token, 'warehouses')
	const warehouses =
		warehousesRes.json.data || warehousesRes.json.warehouses || []
	const ids = warehouses.map(w => w.warehouseId).filter(Boolean)
	record(
		'GET /warehouses',
		warehousesRes.status === 200 && ids.length > 0,
		`${ids.length} warehouses`,
	)

	const [w1, w2] = ids
	const two = w2 ? `${w1},${w2}` : null

	const stale = await request(token, 'products', {
		scope: '00000000-0000-4000-8000-000000000000',
	})
	record(
		'stale x-warehouse-scope does not crash (2xx/4xx, process still up)',
		stale.status >= 200 && stale.status < 500,
		`status ${stale.status}`,
	)

	const ping = await request(token, 'warehouses')
	record(
		'API still up after stale header',
		ping.status === 200,
		`status ${ping.status}`,
	)

	if (w1) {
		const scoped = await request(token, 'selling-invoices', { scope: w1 })
		record(
			'operational GET selling-invoices',
			scoped.status === 200,
			`status ${scoped.status} count=${scoped.json.totalCount ?? scoped.json.invoices?.length ?? '?'}`,
		)

		const blockedInvoice = await request(token, 'selling-invoices', {
			method: 'POST',
			scope: two || `${w1},${w1}`,
			body: { items: [] },
		})
		const invoiceBlocked =
			blockedInvoice.status >= 400 &&
			String(blockedInvoice.json.message || '')
				.toLowerCase()
				.includes('warehouse')
		record(
			'combined POST selling-invoices blocked',
			two ? invoiceBlocked : blockedInvoice.status >= 400,
			`status ${blockedInvoice.status} ${blockedInvoice.json.message || ''}`,
		)

		const blockedTransfer = await request(
			token,
			'inventory/warehouse-transfer',
			{
				method: 'POST',
				scope: two || `${w1},${w1}`,
				body: {
					toWarehouseId: w2 || w1,
					items: [
						{ productId: '00000000-0000-4000-8000-000000000000', quantity: 1 },
					],
				},
			},
		)
		record(
			'combined POST warehouse-transfer blocked',
			blockedTransfer.status >= 400,
			`status ${blockedTransfer.status} ${blockedTransfer.json.message || ''}`,
		)
	}

	if (two) {
		const a = await request(token, 'selling-invoices', { scope: w1 })
		const b = await request(token, 'selling-invoices', { scope: two })
		const aCount = a.json.totalCount ?? a.json.invoices?.length ?? 0
		const bCount = b.json.totalCount ?? b.json.invoices?.length ?? 0
		record(
			'dashboard scope: combined invoice count >= single warehouse',
			b.status === 200 && a.status === 200 && bCount >= aCount,
			`W1=${aCount} W1+W2=${bCount}`,
		)
	} else {
		record('dashboard combined vs single', false, 'need two warehouses')
	}

	const failed = results.filter(row => !row.ok)
	console.log(`\n${results.length - failed.length}/${results.length} passed`)
	process.exit(failed.length ? 1 : 0)
}

main().catch(error => {
	console.error(error.message)
	process.exit(1)
})
