import { text, timestamp } from 'drizzle-orm/pg-core'

// Keys are camelCase; the client and drizzle-kit both run with casing: 'snake_case'.

export const tz = () => timestamp({ withTimezone: true })

/** Mongo `_id` (ObjectId hex or the string id the model sets), kept so every reference stays valid. */
export const docId = { id: text().primaryKey() }

export const tenantCol = { tenantId: text().notNull() }

// Some Mongo models have no `timestamps`; the ETL fills those from the ObjectId time.
export const timestamps = {
	createdAt: tz().notNull().defaultNow(),
	updatedAt: tz().notNull().defaultNow(),
}

/** `createdBy` / `updatedBy` subdocuments as columns (ADR: one convention for the schema). */
export const audit = {
	createdById: text(),
	createdByName: text(),
	createdByRole: text(),
	createdByAt: tz(),
	updatedById: text(),
	updatedByName: text(),
	updatedByRole: text(),
	updatedByAt: tz(),
}
