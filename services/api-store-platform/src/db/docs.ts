import { and, eq, sql, SQL } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { Model } from 'mongoose'

import {
	ALL_TENANTS,
	anyOf,
	DbTx,
	Executor,
	getDb,
	inTransaction,
	requireTenantId,
	TenantScope,
} from '.'
import { Doc, MapResult, mapDocs, Row, Spec, SPECS } from './etl/mongoToPg'
import * as t from './schema'

/**
 * Postgres rows → the document shape Mongoose `.lean()` returned, so ported
 * reads answer exactly like before. Inverse of the ETL specs in
 * `etl/mongoToPg.ts`; `pg:etl --verify` checks it field by field on real data.
 * Null columns are left out, as missing fields were in Mongo.
 */

const CREATED = {
	createdById: '_id',
	createdByName: 'displayName',
	createdByRole: 'role',
	createdByAt: 'createdAt',
} as const
const UPDATED = {
	updatedById: '_id',
	updatedByName: 'displayName',
	updatedByRole: 'role',
	updatedByAt: 'updatedAt',
} as const

const STRIP_FROM_CHILD = new Set([
	'tenantId',
	'position',
	'invoiceRowId',
	'buyingInvoiceRowId',
	'partyType',
	'partyId',
	'employeeId',
	'cashAccountId',
])

export const rowToDoc = (table: PgTable, row: Row): Doc => {
	const doc: Doc = {}
	const createdBy: Doc = {}
	const updatedBy: Doc = {}

	for (const column of getTableConfig(table).columns) {
		const key = column.name
		const value = row[key]

		if (value === null || value === undefined || key === 'seq') continue

		if (key in CREATED) {
			createdBy[CREATED[key as keyof typeof CREATED]] = value
		} else if (key in UPDATED) {
			updatedBy[UPDATED[key as keyof typeof UPDATED]] = value
		} else {
			doc[key === 'id' ? '_id' : key] =
				column.columnType === 'PgNumeric' ? Number(value) : value
		}
	}

	if (Object.keys(createdBy).length) doc.createdBy = createdBy

	if (Object.keys(updatedBy).length) doc.updatedBy = updatedBy

	return doc
}

const childDocs = (
	table: PgTable,
	rows: Row[] | undefined,
	belongs: (row: Row) => boolean,
): Doc[] =>
	(rows ?? [])
		.filter(belongs)
		.sort((a, b) => Number(a.position) - Number(b.position))
		.map(row => {
			const doc = rowToDoc(table, row)

			for (const key of STRIP_FROM_CHILD) delete doc[key]

			return doc
		})

type Children = Map<PgTable, Row[]>

/** `always`: Mongoose default is [] (field always present); otherwise omit when empty. */
const setList = (doc: Doc, field: string, items: Doc[], always: boolean) => {
	if (items.length || always) doc[field] = items
}

const pick = (doc: Doc, prefix: string, fields: Record<string, string>) => {
	const sub: Doc = {}

	for (const [column, field] of Object.entries(fields)) {
		const key = `${prefix}${column}`

		if (doc[key] !== undefined) sub[field] = doc[key]

		delete doc[key]
	}

	return Object.keys(sub).length ? sub : undefined
}

const invoiceAttach =
	(items: PgTable, amounts: PgTable, tenders: PgTable, link: string) =>
	(doc: Doc, children: Children) => {
		const mine = (row: Row) => row[link] === doc._id

		setList(doc, 'items', childDocs(items, children.get(items), mine), true)
		setList(
			doc,
			'currencyAmounts',
			childDocs(amounts, children.get(amounts), mine),
			true,
		)

		setList(
			doc,
			'tenders',
			childDocs(tenders, children.get(tenders), mine),
			false,
		)

		return doc
	}

const openingBalancesAttach =
	(partyType: string, idKey: string) => (doc: Doc, children: Children) => {
		setList(
			doc,
			'openingBalances',
			childDocs(
				t.partyOpeningBalances,
				children.get(t.partyOpeningBalances),
				row => row.partyType === partyType && row.partyId === doc[idKey],
			),
			false,
		)

		return doc
	}

type Inverse = {
	unflatten?: (doc: Doc) => Doc
	attach?: (doc: Doc, children: Children) => Doc
}

const INVERSE: Record<string, Inverse> = {
	Tenant: {
		unflatten: doc => {
			const invoiceAi = pick(doc, 'invoiceAi', {
				MonthlyLimit: 'monthlyLimit',
				ActivatedAt: 'activatedAt',
				PeriodStart: 'periodStart',
				UsedInPeriod: 'usedInPeriod',
				CarryOver: 'carryOver',
			})
			const subscription = pick(doc, 'subscription', {
				StartDate: 'startDate',
				RenewalDate: 'renewalDate',
				Status: 'status',
				RenewalEnabled: 'renewalEnabled',
				LastRenewalDate: 'lastRenewalDate',
				NotifiedForDate: 'notifiedForDate',
				CreatedAt: 'createdAt',
				UpdatedAt: 'updatedAt',
			})
			const productImport = pick(doc, 'productImport', { Status: 'status' })

			if (subscription) {
				// schema defaults are null, stored as null in Mongo
				subscription.lastRenewalDate ??= null
				subscription.notifiedForDate ??= null
			}

			return { ...doc, invoiceAi, subscription, productImport }
		},
	},
	User: {
		unflatten: doc => {
			const user = pick(doc, '', {
				firstName: 'firstName',
				lastName: 'lastName',
			})

			return { ...doc, user }
		},
	},
	SubscriptionRenewalRequest: {
		unflatten: doc => {
			const actor = { Id: 'userId', Name: 'displayName' }
			const requestedBy = pick(doc, 'requestedBy', actor)
			const reviewedBy = pick(doc, 'reviewedBy', actor)

			// schema defaults are null, stored as null in Mongo
			return {
				...doc,
				requestedBy,
				reviewedBy,
				reviewedAt: doc.reviewedAt ?? null,
				rejectionReason: doc.rejectionReason ?? null,
			}
		},
	},
	Products: {
		// price._id (Mongoose subdocument id) is not kept: nothing reads it.
		unflatten: doc => {
			const price = pick(doc, '', {
				purchasePrice: 'purchasePrice',
				retailPrice: 'retailPrice',
				wholesalePrice: 'wholesalePrice',
				semiWholesalePrice: 'semiWholesalePrice',
				discount: 'discount',
				priceCurrency: 'currency',
			})

			return { ...doc, price }
		},
	},
	CurrencySettings: {
		attach: (doc, children) => {
			const rows = (children.get(t.currencySettingItems) ?? []).filter(
				row => row.tenantId === doc.tenantId,
			)
			const items = (primary: boolean) =>
				childDocs(
					t.currencySettingItems,
					rows,
					row => row.isPrimary === primary,
				).map(item => {
					delete item.isPrimary

					return item
				})

			doc.primaryCurrency = items(true)[0] ?? null
			doc.secondaryCurrencies = items(false)

			return doc
		},
	},
	Customer: { attach: openingBalancesAttach('customer', 'customerId') },
	Supplier: { attach: openingBalancesAttach('supplier', 'supplierId') },
	Employee: {
		attach: (doc, children) => {
			const mine = (row: Row) => row.employeeId === doc.employeeId

			setList(
				doc,
				'salaries',
				childDocs(t.employeeSalaries, children.get(t.employeeSalaries), mine),
				true,
			)

			setList(
				doc,
				'payouts',
				childDocs(t.employeePayouts, children.get(t.employeePayouts), mine),
				true,
			)

			return doc
		},
	},
	CashAccount: {
		attach: (doc, children) => {
			doc.balances = Object.fromEntries(
				(children.get(t.cashAccountBalances) ?? [])
					.filter(row => row.cashAccountId === doc.cashAccountId)
					.map(row => [row.currencyId, Number(row.amount)]),
			)

			return doc
		},
	},
	Invoice: {
		attach: invoiceAttach(
			t.invoiceItems,
			t.invoiceCurrencyAmounts,
			t.invoiceTenders,
			'invoiceRowId',
		),
	},
	BuyingInvoice: {
		attach: invoiceAttach(
			t.buyingInvoiceItems,
			t.buyingInvoiceCurrencyAmounts,
			t.buyingInvoiceTenders,
			'buyingInvoiceRowId',
		),
	},
}

const dropUndefined = (doc: Doc) => {
	for (const key of Object.keys(doc)) {
		if (doc[key] === undefined) delete doc[key]
	}

	return doc
}

export const specFor = (table: PgTable): Spec => {
	const spec = SPECS.find(s => s.table === table)

	if (!spec) {
		throw new Error(`no spec for table ${getTableConfig(table).name}`)
	}

	return spec
}

/** Rows of one spec table (+ the child rows of the same parents) → lean documents. */
export const toDocs = (
	table: PgTable,
	rows: Row[],
	children: Children = new Map(),
): Doc[] => {
	const spec = specFor(table)
	const inverse = INVERSE[spec.model] ?? {}

	return rows.map(row => {
		let doc = rowToDoc(table, row)

		doc = inverse.unflatten?.(doc) ?? doc
		doc = inverse.attach?.(doc, children) ?? doc

		return dropUndefined(doc)
	})
}

// ---------- runtime helpers for ported repositories ----------

/** Child tables of each parent table and the parent field they hang off. */
const CHILD_LINKS = new Map<
	PgTable,
	Array<{ table: PgTable; link: string; parentKey: string; extra?: Row }>
>([
	[
		t.currencySettings,
		[
			{
				table: t.currencySettingItems,
				link: 'tenantId',
				parentKey: 'tenantId',
			},
		],
	],
	[
		t.customers,
		[
			{
				table: t.partyOpeningBalances,
				link: 'partyId',
				parentKey: 'customerId',
				extra: { partyType: 'customer' },
			},
		],
	],
	[
		t.suppliers,
		[
			{
				table: t.partyOpeningBalances,
				link: 'partyId',
				parentKey: 'supplierId',
				extra: { partyType: 'supplier' },
			},
		],
	],
	[
		t.employees,
		[
			{
				table: t.employeeSalaries,
				link: 'employeeId',
				parentKey: 'employeeId',
			},
			{ table: t.employeePayouts, link: 'employeeId', parentKey: 'employeeId' },
		],
	],
	[
		t.cashAccounts,
		[
			{
				table: t.cashAccountBalances,
				link: 'cashAccountId',
				parentKey: 'cashAccountId',
			},
		],
	],
	[
		t.invoices,
		[
			{ table: t.invoiceItems, link: 'invoiceRowId', parentKey: 'id' },
			{
				table: t.invoiceCurrencyAmounts,
				link: 'invoiceRowId',
				parentKey: 'id',
			},
			{ table: t.invoiceTenders, link: 'invoiceRowId', parentKey: 'id' },
		],
	],
	[
		t.buyingInvoices,
		[
			{
				table: t.buyingInvoiceItems,
				link: 'buyingInvoiceRowId',
				parentKey: 'id',
			},
			{
				table: t.buyingInvoiceCurrencyAmounts,
				link: 'buyingInvoiceRowId',
				parentKey: 'id',
			},
			{
				table: t.buyingInvoiceTenders,
				link: 'buyingInvoiceRowId',
				parentKey: 'id',
			},
		],
	],
])

const column = (table: PgTable, name: string) => {
	const found = getTableConfig(table).columns.find(c => c.name === name)

	if (!found) throw new Error(`${getTableConfig(table).name} has no ${name}`)

	return found
}

/** The tenant condition; none for ALL_TENANTS. */
export const tenantWhere = (table: PgTable, tenantId: TenantScope) =>
	tenantId === ALL_TENANTS
		? undefined
		: eq(column(table, 'tenantId'), requireTenantId(tenantId))

/**
 * Lean documents from one table, tenant-scoped, with child arrays attached.
 * `where` narrows further (Drizzle condition); `order` / `limit` / `offset` as in SQL.
 */
export const findDocs = async (
	table: PgTable,
	tenantId: TenantScope,
	options: {
		where?: SQL
		order?: SQL[]
		limit?: number
		offset?: number
		db?: Executor
		/** SELECT … FOR UPDATE (inside a transaction). */
		lock?: boolean
		/** Child tables not to load (their array fields come back empty). */
		skipChildren?: PgTable[]
	} = {},
): Promise<Doc[]> => {
	const db = options.db ?? getDb()
	const scoped = and(tenantWhere(table, tenantId), options.where)
	let query = db.select().from(table).where(scoped).$dynamic()

	// no explicit order = Mongo natural (insertion) order
	query = query.orderBy(
		...(options.order?.length
			? options.order
			: [sql`${column(table, 'seq')} asc`]),
	)

	if (options.limit !== undefined) query = query.limit(options.limit)

	if (options.offset !== undefined) query = query.offset(options.offset)

	if (options.lock) query = query.for('update')

	const rows = (await query) as Row[]
	const children: Children = new Map()

	for (const child of CHILD_LINKS.get(table) ?? []) {
		if (options.skipChildren?.includes(child.table)) continue

		const keys = [...new Set(rows.map(row => row[child.parentKey] as string))]

		if (!keys.length) continue

		const conditions = [
			tenantWhere(child.table, tenantId),
			anyOf(column(child.table, child.link), keys),
			...Object.entries(child.extra ?? {}).map(([key, value]) =>
				eq(column(child.table, key), value),
			),
		]

		children.set(
			child.table,
			(await db
				.select()
				.from(child.table)
				.where(and(...conditions))) as Row[],
		)
	}

	return toDocs(table, rows, children)
}

export const findDoc = async (
	table: PgTable,
	tenantId: TenantScope,
	where: SQL,
	db?: Executor,
	lock = false,
): Promise<Doc | null> =>
	(await findDocs(table, tenantId, { where, limit: 1, db, lock }))[0] ?? null

/**
 * Create one document like `new Model(payload).save()`: the Mongoose model still
 * validates, casts and fills defaults (no connection needed), then the ETL
 * mapping writes the row and its children. A field with no column is an error.
 * shortcut: Mongoose kept as a validation-only library; replace in PG-MIG-6.
 */
export const insertDoc = async (
	model: Model<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
	payload: Doc,
	db: Executor = getDb(),
): Promise<Doc> => {
	const spec = specForModel(model)
	const document = new model(payload)

	document.initializeTimestamps?.() // like save(): createdAt/updatedAt in the returned doc too
	await document.validate()

	const plain = document.toObject() as Doc
	const rows = writeRows(spec, plain)

	await db.insert(spec.table).values((rows.get(spec.table) ?? []) as never)

	for (const [table, childRows] of rows) {
		if (table !== spec.table && childRows.length) {
			await db.insert(table).values(childRows as never)
		}
	}

	return { ...plain, _id: String(plain._id) }
}

const writeRows = (spec: Spec, plain: Doc) => {
	const result: MapResult = { rows: new Map(), unmapped: new Map(), errors: [] }

	mapDocs(spec, [plain], result)

	if (result.errors.length || result.unmapped.size) {
		const problems = [
			...result.errors,
			...[...result.unmapped.keys()].map(key => `no column for ${key}`),
		]

		throw new Error(`cannot store ${spec.model}: ${problems.join('; ')}`)
	}

	return result.rows
}

const deleteChildren = async (
	db: Executor,
	table: PgTable,
	tenantId: TenantScope,
	parents: Doc[],
) => {
	for (const child of CHILD_LINKS.get(table) ?? []) {
		const field = child.parentKey === 'id' ? '_id' : child.parentKey
		const keys = [...new Set(parents.map(doc => String(doc[field])))]

		if (!keys.length) continue

		await db
			.delete(child.table)
			.where(
				and(
					tenantWhere(child.table, tenantId),
					anyOf(column(child.table, child.link), keys),
					...Object.entries(child.extra ?? {}).map(([key, value]) =>
						eq(column(child.table, key), value),
					),
				),
			)
	}
}

/**
 * `findOneAndUpdate(filter, { $set: payload }, { runValidators: true, new: true })`:
 * validates only the changed paths (old records stay editable), locks the row,
 * replaces child arrays, returns the updated lean doc or null when nothing matched.
 */
export const updateDoc = (
	model: Model<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
	tenantId: TenantScope,
	where: SQL,
	payload: Doc,
	tx?: DbTx,
): Promise<Doc | null> =>
	inTransaction(tx, async db => {
		const spec = specForModel(model)
		const existing = await findDoc(spec.table, tenantId, where, db, true)

		if (!existing) return null

		const document = new model({ ...existing, ...payload })

		await document.validate(Object.keys(payload))

		const rows = writeRows(spec, document.toObject() as Doc)
		const changes: Row = { ...(rows.get(spec.table) ?? [])[0] }
		const idColumn = column(spec.table, 'id')

		for (const key of ['id', 'tenantId', 'createdAt']) delete changes[key]

		await db
			.update(spec.table)
			.set({ ...changes, updatedAt: new Date() } as never)
			.where(eq(idColumn, String(existing._id)))

		await deleteChildren(db, spec.table, tenantId, [existing])

		for (const [table, childRows] of rows) {
			if (table !== spec.table && childRows.length) {
				await db.insert(table).values(childRows as never)
			}
		}

		return findDoc(spec.table, tenantId, eq(idColumn, String(existing._id)), db)
	})

/** Deletes matching docs and their child rows; returns the deleted lean docs. */
export const deleteDocs = (
	table: PgTable,
	tenantId: TenantScope,
	where: SQL,
	tx?: DbTx,
): Promise<Doc[]> =>
	inTransaction(tx, async db => {
		const docs = await findDocs(table, tenantId, { where, db, lock: true })

		if (!docs.length) return docs

		await deleteChildren(db, table, tenantId, docs)
		await db.delete(table).where(
			anyOf(
				column(table, 'id'),
				docs.map(doc => String(doc._id)),
			),
		)

		return docs
	})

export const specForModel = (
	model: Model<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
): Spec => {
	const spec = SPECS.find(s => s.model === model.modelName)

	if (!spec) throw new Error(`no Postgres table for model ${model.modelName}`)

	return spec
}

/** `Model.insertMany(docs)` equivalent (validated one by one, like `create`). */
export const insertDocs = async (
	model: Model<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
	docs: Doc[],
	db: Executor = getDb(),
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> => {
	const created: Doc[] = []

	for (const doc of docs) created.push(await insertDoc(model, doc, db))

	return created
}

/**
 * `doc.save()` for a lean doc that was loaded and changed in place: writes it
 * back (validated, row locked). Throws when the row is gone, like Mongoose.
 */
export const saveDoc = async (
	model: Model<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
	tenantId: TenantScope,
	doc: Doc,
	tx?: DbTx,
): Promise<Doc> => {
	const table = specForModel(model).table
	const fields: Doc = { ...doc }

	for (const key of ['_id', 'tenantId', 'createdAt', 'createdBy'])
		delete fields[key]

	// `doc.x = undefined; doc.save()` unset x in Mongoose; null clears the column
	for (const key of Object.keys(fields)) {
		if (fields[key] === undefined) fields[key] = null
	}

	const saved = await updateDoc(
		model,
		tenantId,
		eq(column(table, 'id'), String(doc._id)),
		fields,
		tx,
	)

	if (!saved)
		throw new Error(`${model.modelName} ${String(doc._id)} no longer exists`)

	return saved
}

/** Child tables of a parent table, with the extra condition that selects its rows. */
export const childLinksOf = (table: PgTable) =>
	(CHILD_LINKS.get(table) ?? []).map(child => ({
		table: child.table,
		extra: child.extra ?? {},
	}))
