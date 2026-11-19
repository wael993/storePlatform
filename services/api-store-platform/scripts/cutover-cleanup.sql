-- Cutover cleanup (PG-MIG-4, after the Mongo → Postgres load). Deletes only rows that are
-- provably dead, for every tenant; owner decision 2026-11-17 (PG-AUDIT C1 #1 and #3).
--
--   psql "$DATABASE_URL" -f scripts/cutover-cleanup.sql              dry run: counts, then ROLLBACK
--   psql "$DATABASE_URL" -v apply=1 -f scripts/cutover-cleanup.sql   delete for real (COMMIT)
--
-- 1. Stock rows whose product does not exist in the tenant (failed Mongo-era imports, 2026-09).
--    Invisible in the app (stock screens join products); no stock movement keeps them alive.
-- 2. Cash accounts on a warehouse that is not the tenant's (TENANT-WH bug, fixed in d90b3ea),
--    only when they never had a ledger entry and hold no money; their balance rows go with them.
\set ON_ERROR_STOP on
\if :{?apply}
\else
\set apply 0
\endif

begin;

with gone as (
	delete from store.inventories i
	where not exists (
		select 1 from store.products p where p.tenant_id = i.tenant_id and p.product_id = i.product_id)
	returning i.tenant_id, i.quantity
)
select 'stock rows without product' as deleted, tenant_id, count(*) as n,
	count(*) filter (where quantity <> 0) as with_quantity
from gone group by tenant_id order by n desc;

with dead as (
	select a.tenant_id, a.cash_account_id from store.cash_accounts a
	where not exists (
			select 1 from store.warehouses w where w.tenant_id = a.tenant_id and w.warehouse_id = a.warehouse_id)
		and not exists (
			select 1 from store.cash_ledger_entries l where l.tenant_id = a.tenant_id and l.cash_account_id = a.cash_account_id)
		and not exists (
			select 1 from store.cash_account_balances b
			where b.tenant_id = a.tenant_id and b.cash_account_id = a.cash_account_id and b.amount <> 0)
),
balances as (
	delete from store.cash_account_balances b using dead d
	where b.tenant_id = d.tenant_id and b.cash_account_id = d.cash_account_id
	returning b.tenant_id
),
accounts as (
	delete from store.cash_accounts a using dead d
	where a.tenant_id = d.tenant_id and a.cash_account_id = d.cash_account_id
	returning a.tenant_id
)
select 'empty cash accounts on a foreign warehouse' as deleted, tenant_id, count(*) as n,
	(select count(*) from balances) as zero_balance_rows
from accounts group by tenant_id;

\if :apply
commit;
\echo 'cutover-cleanup: COMMITTED'
\else
rollback;
\echo 'cutover-cleanup: dry run, nothing changed (add -v apply=1 to delete)'
\endif
