import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import * as store from '../db/schema/store'
import { isTenantDataChange } from '../shared/backup/dataVersion'
import { BACKUP_TABLES, EXCLUDED_TABLES } from '../shared/backup/tables'

const storeTables = (Object.values(store) as unknown[])
	.filter((value): value is PgTable => value instanceof PgTable)
	.map(getTableConfig)

describe('backup table classification', () => {
	it('backs up every store table that is not excluded with a reason', () => {
		const names = storeTables.map(table => table.name)

		// a typo in the exclude list would silently back the table up
		expect(names).toEqual(expect.arrayContaining(Object.keys(EXCLUDED_TABLES)))
		expect(BACKUP_TABLES.map(table => table.name).sort()).toEqual(
			names.filter(name => !(name in EXCLUDED_TABLES)).sort(),
		)
	})

	it('restores parents before their child tables', () => {
		const order = BACKUP_TABLES.map(table => table.name)

		for (const table of storeTables) {
			for (const fk of table.foreignKeys) {
				const parent = getTableConfig(fk.reference().foreignTable).name

				expect(
					order.indexOf(parent),
					`${parent} before ${table.name}`,
				).toBeLessThan(order.indexOf(table.name))
			}
		}
	})

	it('only backs up tables that carry tenant_id', () => {
		for (const table of storeTables.filter(t => !(t.name in EXCLUDED_TABLES))) {
			expect(
				table.columns.map(column => column.name),
				table.name,
			).toContain('tenantId')
		}
	})
})

describe('isTenantDataChange', () => {
	it('counts successful and failed-server writes, not reads, rejects or backup calls', () => {
		expect(isTenantDataChange('POST', '/api/data/products', 201)).toBe(true)
		expect(isTenantDataChange('DELETE', '/api/data/products/1', 500)).toBe(true)
		expect(isTenantDataChange('GET', '/api/data/products', 200)).toBe(false)
		expect(isTenantDataChange('PATCH', '/api/data/products/1', 422)).toBe(false)
		expect(isTenantDataChange('POST', '/api/data/backup/run', 202)).toBe(false)
	})
})
