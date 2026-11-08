import { randomUUID } from 'crypto'
import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { closeDb, getDb } from '../db'
import {
	getCashBalancesForWarehouses,
	listCashLedgerEntries,
	postInternalCashExchange,
	postInternalCashTransfer,
	postOpeningBalance,
	syncCashEffectsForReference,
} from '../shared/cashAccounts/ledgerService'
import type { RequestContext } from '../shared/types'

// Real Postgres (migrated). CI provides DATABASE_URL; locally see docs/architecture/postgres-migration.md.
const enabled = Boolean(process.env.DATABASE_URL)

const WH = 'wh-1'

const setup = () => {
	const tenantId = `t-${randomUUID()}`
	const ctx = {
		tenantId,
		role: 'owner',
		userId: 'u-1',
		user: { firstName: 'Ana', lastName: 'B' },
	} as unknown as RequestContext

	return { tenantId, ctx }
}

const balances = async (tenantId: string) =>
	Object.fromEntries(
		(await getCashBalancesForWarehouses(tenantId, [WH])).accounts.map(a => [
			a.type,
			a.balances,
		]),
	)

/** Invariant: per account and currency, balance == sum of ledger rows. */
const expectLedgerMatchesBalances = async (tenantId: string) => {
	const { rows } = await getDb().execute<{ diff: string }>(sql`
		select coalesce(l.cash_account_id, b.cash_account_id) as account,
		       coalesce(l.total, 0) - coalesce(b.amount, 0) as diff
		from (select cash_account_id, currency_id, sum(amount) as total
		      from store.cash_ledger_entries where tenant_id = ${tenantId}
		      group by 1, 2) l
		full join (select * from store.cash_account_balances where tenant_id = ${tenantId}) b
		  on b.cash_account_id = l.cash_account_id and b.currency_id = l.currency_id
		where coalesce(l.total, 0) <> coalesce(b.amount, 0)`)

	expect(rows).toEqual([])
}

const ledgerCount = async (tenantId: string) => {
	const { rows } = await getDb().execute<{ n: number }>(
		sql`select count(*)::int as n from store.cash_ledger_entries where tenant_id = ${tenantId}`,
	)

	return rows[0].n
}

describe.skipIf(!enabled)('ledgerService (Postgres)', () => {
	afterAll(closeDb)

	it('moves money between accounts and keeps ledger == balances', async () => {
		const { tenantId, ctx } = setup()

		await postOpeningBalance({
			tenantId,
			warehouseId: WH,
			accountType: 'daily_cash',
			amount: 100,
			currencyId: 'usd',
		})

		await postInternalCashTransfer({
			requestContext: ctx,
			warehouseId: WH,
			fromAccountType: 'daily_cash',
			toAccountType: 'cash_reserve',
			amount: 30.1,
			currencyId: 'usd',
		})

		const result = await balances(tenantId)

		expect(result.daily_cash).toEqual({ usd: 69.9 })
		expect(result.cash_reserve).toEqual({ usd: 30.1 })
		await expectLedgerMatchesBalances(tenantId)
	})

	it('rejects an overdraft and writes nothing', async () => {
		const { tenantId, ctx } = setup()

		await postOpeningBalance({
			tenantId,
			warehouseId: WH,
			accountType: 'daily_cash',
			amount: 10,
			currencyId: 'usd',
		})

		const before = await ledgerCount(tenantId)

		await expect(
			postInternalCashTransfer({
				requestContext: ctx,
				warehouseId: WH,
				fromAccountType: 'daily_cash',
				toAccountType: 'cash_reserve',
				amount: 11,
				currencyId: 'usd',
			}),
		).rejects.toThrow(
			'Amount exceeds available balance in Daily Cash (10.00 usd).',
		)

		// another currency on the same account does not cover a debit
		await expect(
			postInternalCashTransfer({
				requestContext: ctx,
				warehouseId: WH,
				fromAccountType: 'daily_cash',
				toAccountType: 'cash_reserve',
				amount: 1,
				currencyId: 'eur',
			}),
		).rejects.toThrow('exceeds available balance')

		expect(await ledgerCount(tenantId)).toBe(before)
		expect((await balances(tenantId)).daily_cash).toEqual({ usd: 10 })
		await expectLedgerMatchesBalances(tenantId)
	})

	it('syncs document effects idempotently and reverses on change', async () => {
		const { tenantId, ctx } = setup()
		const sync = (amount: number) =>
			syncCashEffectsForReference({
				requestContext: ctx,
				tenantId,
				warehouseId: WH,
				referenceType: 'selling_invoice',
				referenceId: 'inv-1',
				desired: [
					{
						accountType: 'daily_cash',
						currencyId: 'usd',
						amount,
						movementType: 'SALE',
					},
				],
			})

		await sync(50)
		await sync(50) // replay: no new rows
		expect(await ledgerCount(tenantId)).toBe(1)

		await sync(40) // edit: reversal of 50, then +40
		expect(await ledgerCount(tenantId)).toBe(3)
		expect((await balances(tenantId)).daily_cash).toEqual({ usd: 40 })
		await expectLedgerMatchesBalances(tenantId)

		await sync(50) // back to the first amount: must post again, not dedupe against it
		expect((await balances(tenantId)).daily_cash).toEqual({ usd: 50 })
		await sync(50) // replay
		expect(await ledgerCount(tenantId)).toBe(5)
		await expectLedgerMatchesBalances(tenantId)
	})

	it('answers exchange replays and rejects changed values', async () => {
		const { tenantId, ctx } = setup()

		await postOpeningBalance({
			tenantId,
			warehouseId: WH,
			accountType: 'daily_cash',
			amount: 100,
			currencyId: 'usd',
		})

		const exchange = (toAmount: number) =>
			postInternalCashExchange({
				requestContext: ctx,
				warehouseId: WH,
				accountType: 'daily_cash',
				fromCurrencyId: 'usd',
				toCurrencyId: 'eur',
				fromAmount: 100,
				toAmount,
				fromExchangeRateToPrimary: 1,
				toExchangeRateToPrimary: 0.9,
				exchangeId: 'ex-1',
			})

		await exchange(90)
		await exchange(90)
		expect((await balances(tenantId)).daily_cash).toEqual({ usd: 0, eur: 90 })
		await expect(exchange(90.01)).rejects.toThrow(
			'This exchange was already recorded with different values.',
		)

		const list = await listCashLedgerEntries({
			tenantId,
			warehouseIds: [WH],
			movementType: 'EXCHANGE',
		})

		expect(list.totalCount).toBe(2)
		expect(list.totalsByCurrency).toEqual({ usd: -100, eur: 90 })
		expect(
			list.entries.find(e => e.currencyId === 'usd')?.exchangeCounterLeg,
		).toEqual({ currencyId: 'eur', amount: 90 })

		expect(list.entries[0].createdBy.displayName).toBe('Ana B')
		await expectLedgerMatchesBalances(tenantId)
	})

	it('fails closed without tenant context', async () => {
		await expect(
			syncCashEffectsForReference({
				tenantId: '',
				warehouseId: WH,
				referenceType: 'selling_invoice',
				referenceId: 'x',
				desired: [],
			}),
		).rejects.toThrow('Tenant-scoped query is missing tenant context.')
	})
})
