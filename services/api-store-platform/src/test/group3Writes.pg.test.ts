import { randomUUID } from 'crypto'
import { afterAll, describe, expect, it } from 'vitest'

import { closeDb, isUniqueViolation } from '../db'
import { insertDoc } from '../db/docs'
import { pgFind, pgFindOneAndUpdate, pgUpdateMany } from '../db/mongoQuery'
import { LabelTemplate, SYSTEM_LABEL_LAYOUT } from '../models/LabelTemplate'
import { NotificationRead } from '../models/NotificationRead'
import UserSettings from '../models/UserSettings'

/** Group 3 write paths the read-only api:diff cannot cover. */
const enabled = Boolean(process.env.DATABASE_URL)
const actor = { _id: 'u-1', displayName: 'Ana', createdAt: new Date() }

describe.skipIf(!enabled)('group 3 writes (Postgres)', () => {
	afterAll(closeDb)

	it('marks a notification read once, even when repeated (upsert with only $setOnInsert)', async () => {
		const tenantId = `t-${randomUUID()}`
		const runAt = new Date('2026-11-01T03:00:00Z')
		const markRead = () =>
			pgFindOneAndUpdate(
				NotificationRead,
				tenantId,
				{ userId: 'u-1', runAt, type: 'LOW_STOCK_DIGEST' },
				{
					$setOnInsert: {
						tenantId,
						userId: 'u-1',
						runAt,
						type: 'LOW_STOCK_DIGEST',
					},
				},
				{ upsert: true },
			)

		await markRead()
		await markRead() // existing row: nothing to apply, must not throw

		// two at once: one inserts, the other hits the unique index (handled by callers)
		const results = await Promise.allSettled([markRead(), markRead()])

		for (const result of results) {
			if (result.status === 'rejected') {
				expect(isUniqueViolation(result.reason)).toBe(true)
			}
		}

		expect(await pgFind(NotificationRead, tenantId, {})).toHaveLength(1)
	})

	it('allows only one default label template per tenant (unique violation is detected)', async () => {
		const tenantId = `t-${randomUUID()}`
		const template = (templateId: string, isDefault: boolean) =>
			insertDoc(LabelTemplate, {
				tenantId,
				templateId,
				name: templateId,
				isDefault,
				layout: SYSTEM_LABEL_LAYOUT,
				createdBy: actor,
			})

		await template('a', true)
		await template('b', false)

		const second = pgUpdateMany(
			LabelTemplate,
			tenantId,
			{ templateId: 'b' },
			{ $set: { isDefault: true } },
		)

		await expect(second).rejects.toSatisfy(isUniqueViolation)
	})

	it('upserts user settings: creates, then updates the same row', async () => {
		const tenantId = `t-${randomUUID()}`
		const save = (productsPerPage: number) =>
			pgFindOneAndUpdate(
				UserSettings,
				tenantId,
				{ userId: 'u-1' },
				{ productsPerPage },
				{ new: true, upsert: true },
			)

		expect(await save(20)).toMatchObject({ userId: 'u-1', productsPerPage: 20 })
		expect(await save(50)).toMatchObject({ productsPerPage: 50 })
		expect(await pgFind(UserSettings, tenantId, {})).toHaveLength(1)
	})
})
