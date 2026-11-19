-- Reconcile report after the load (runbook step 6). Read only: plain SELECTs in a read-only
-- transaction, so it never changes anything.
--
--   psql "$DATABASE_URL" -X -f scripts/reconcile.sql
--
-- BLOCKING rows must all be 0 before the API is opened (go / no-go). INFO rows are known data
-- findings (decided in PG-AUDIT C1); compare them with the rehearsal numbers.
\set ON_ERROR_STOP on
begin transaction read only;

-- REPORT -----------------------------------------------------------------------------------

\echo ''
\echo '== Tenants loaded'
select t.name, t.tenant_id,
	(select count(*) from platform.users u where u.tenant_id = t.tenant_id) users,
	(select count(*) from store.products p where p.tenant_id = t.tenant_id) products,
	(select count(*) from store.invoices i where i.tenant_id = t.tenant_id) sales,
	(select count(*) from store.buying_invoices b where b.tenant_id = t.tenant_id) purchases,
	(select count(*) from store.cash_ledger_entries l where l.tenant_id = t.tenant_id) ledger
from platform.tenants t order by t.name;

\echo '== Findings (only non-zero) and verdict'
with checks(severity, tenant, check_name, n) as (
	(select 'BLOCKING', t.name, 'duplicate selling invoice numbers', count(*)
	from (select tenant_id from store.invoices where coalesce(invoice_number, '') <> ''
			group by tenant_id, invoice_number having count(*) > 1) d
		join platform.tenants t using (tenant_id)
	group by t.name)
	union all
	(select 'BLOCKING', t.name, 'cash balance <> ledger (account x currency)', count(*)
	from (
		select coalesce(l.tenant_id, b.tenant_id) tenant_id
		from (select tenant_id, cash_account_id, currency_id, sum(amount) total
				from store.cash_ledger_entries group by 1, 2, 3) l
			full join store.cash_account_balances b
				on b.tenant_id = l.tenant_id and b.cash_account_id = l.cash_account_id and b.currency_id = l.currency_id
		where abs(coalesce(l.total, 0) - coalesce(b.amount, 0)) > 1e-6) x
		join platform.tenants t using (tenant_id)
	group by t.name)
	union all
	-- the demo tenant `app` comes from seed-app-tenant, which writes invoices without ledger rows
	(select case when t.tenant_id = 'app' then 'INFO' else 'BLOCKING' end, t.name,
		'invoice: cash posted <> paid (non-draft)' || case when t.tenant_id = 'app' then ' [demo seed]' else '' end, count(*)
	from (
		select i.tenant_id
		from store.invoices i
			join store.invoice_currency_amounts p on p.invoice_row_id = i.id and p.is_primary
			left join (select tenant_id, reference_id, sum(amount) s from store.cash_ledger_entries
					where reference_type = 'selling_invoice' group by 1, 2) c
				on c.tenant_id = i.tenant_id and c.reference_id = i.invoice_id
			left join (select invoice_row_id, sum(applied_amount) s from store.invoice_tenders group by 1) tn
				on tn.invoice_row_id = i.id
		where coalesce(i.status, '') <> 'draft'
			and (select count(distinct currency_id) from store.invoice_tenders x where x.invoice_row_id = i.id) <= 1
			and abs(coalesce(c.s, 0) - case
				when tn.s is not null then tn.s
				when i.payment_type = 'credit' then 0
				else least(p.paid_amount, p.amount) end) > 0.005) x
		join platform.tenants t using (tenant_id)
	group by t.name, t.tenant_id)
	union all
	(select 'BLOCKING', 'all', 'rows of a tenant that does not exist', count(*)
	from (select tenant_id from store.products union all select tenant_id from store.invoices
		union all select tenant_id from store.cash_ledger_entries union all select tenant_id from store.daily_actions
		union all select tenant_id from platform.users) x
	where not exists (select 1 from platform.tenants t where t.tenant_id = x.tenant_id))
	union all
	(select 'BLOCKING', 'all', 'invoice child row in another tenant than its invoice', count(*)
	from store.invoice_items c join store.invoices p on p.id = c.invoice_row_id where c.tenant_id <> p.tenant_id)
	union all
	(select 'BLOCKING', t.name, 'invoice rate <= 0 or primary rate <> 1', count(*)
	from store.invoice_currency_amounts a join platform.tenants t using (tenant_id)
	where a.exchange_rate is null or a.exchange_rate <= 0 or (a.is_primary and a.exchange_rate <> 1)
	group by t.name)
	union all
	(select 'BLOCKING', t.name, 'duplicate buying invoice numbers', count(*)
	from (select tenant_id from store.buying_invoices where coalesce(invoice_number, '') <> ''
			group by tenant_id, invoice_number having count(*) > 1) d
		join platform.tenants t using (tenant_id)
	group by t.name)
	union all
	-- purchases post cash out (negative), so the ledger sum is minus the paid amount
	(select case when t.tenant_id = 'app' then 'INFO' else 'BLOCKING' end, t.name,
		'purchase: cash posted <> paid (non-draft)' || case when t.tenant_id = 'app' then ' [demo seed]' else '' end, count(*)
	from (
		select b.tenant_id
		from store.buying_invoices b
			join store.buying_invoice_currency_amounts p on p.buying_invoice_row_id = b.id and p.is_primary
			left join (select tenant_id, reference_id, sum(amount) s from store.cash_ledger_entries
					where reference_type = 'buying_invoice' group by 1, 2) c
				on c.tenant_id = b.tenant_id and c.reference_id = b.buying_invoice_id
			left join (select buying_invoice_row_id, sum(applied_amount) s from store.buying_invoice_tenders group by 1) tn
				on tn.buying_invoice_row_id = b.id
		where coalesce(b.status, '') <> 'draft'
			and (select count(distinct currency_id) from store.buying_invoice_tenders x where x.buying_invoice_row_id = b.id) <= 1
			and abs(-coalesce(c.s, 0) - case
				when tn.s is not null then tn.s
				when b.payment_type = 'credit' then 0
				else least(p.paid_amount, p.amount) end) > 0.005) x
		join platform.tenants t using (tenant_id)
	group by t.name, t.tenant_id)
	union all
	(select 'BLOCKING', 'all', 'buying invoice child row in another tenant than its invoice', count(*)
	from store.buying_invoice_items c join store.buying_invoices p on p.id = c.buying_invoice_row_id where c.tenant_id <> p.tenant_id)
	union all
	(select 'BLOCKING', t.name, 'buying invoice rate <= 0 or primary rate <> 1', count(*)
	from store.buying_invoice_currency_amounts a join platform.tenants t using (tenant_id)
	where a.exchange_rate is null or a.exchange_rate <= 0 or (a.is_primary and a.exchange_rate <> 1)
	group by t.name)
	-- INFO ---------------------------------------------------------------------------------
	union all
	(select 'INFO', t.name, 'stock rows without product (run cutover-cleanup.sql)', count(*)
	from store.inventories i join platform.tenants t using (tenant_id)
	where not exists (select 1 from store.products p where p.tenant_id = i.tenant_id and p.product_id = i.product_id)
	group by t.name)
	union all
	(select 'INFO', t.name, 'invoices pointing to a missing customer / partner', count(*)
	from store.invoices i join platform.tenants t using (tenant_id)
	where coalesce(i.customer_id, '') <> ''
		and not exists (select 1 from store.customers c where c.tenant_id = i.tenant_id and c.customer_id = i.customer_id)
		-- a sale to a partner stores the partner id in customer_id
		and not exists (select 1 from store.partners p where p.tenant_id = i.tenant_id and p.partner_id = i.customer_id)
	group by t.name)
	union all
	(select 'INFO', t.name, 'purchases pointing to a missing supplier', count(*)
	from store.buying_invoices b join platform.tenants t using (tenant_id)
	where coalesce(b.supplier_id, '') <> ''
		and not exists (select 1 from store.suppliers s where s.tenant_id = b.tenant_id and s.supplier_id = b.supplier_id)
	group by t.name)
	union all
	(select 'INFO', t.name, 'cash accounts on a foreign warehouse', count(*)
	from store.cash_accounts a join platform.tenants t using (tenant_id)
	where not exists (select 1 from store.warehouses w where w.tenant_id = a.tenant_id and w.warehouse_id = a.warehouse_id)
	group by t.name)
	union all
	(select 'INFO', t.name, 'products sharing a barcode', count(*)
	from (select tenant_id from store.products where coalesce(barcode, '') <> ''
			group by tenant_id, barcode having count(*) > 1) d
		join platform.tenants t using (tenant_id)
	group by t.name)
	union all
	(select 'INFO', t.name, 'daily actions without rate', count(*)
	from store.daily_actions d join platform.tenants t using (tenant_id)
	where d.exchange_rate_to_primary is null or d.exchange_rate_to_primary <= 0
	group by t.name)
)
select severity, tenant, check_name, n::text from checks where n > 0
union all
select 'VERDICT', '', case when coalesce(sum(n) filter (where severity = 'BLOCKING'), 0) = 0
		then 'GREEN: no blocking finding'
		else 'RED: blocking finding(s), do not open' end,
	coalesce(sum(n) filter (where severity = 'BLOCKING'), 0)::text
from checks
order by 1, 2, 3;

rollback;
