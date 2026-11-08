CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE SCHEMA "store";
--> statement-breakpoint
CREATE TABLE "platform"."newsroom_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"change_id" text NOT NULL,
	"release_note_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"type" text,
	"description" text DEFAULT '' NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"topic_id" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsroom_changes_changeId_unique" UNIQUE("change_id")
);
--> statement-breakpoint
CREATE TABLE "platform"."newsroom_release_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"release_note_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"version" text DEFAULT '' NOT NULL,
	"content_type" text DEFAULT 'release_note' NOT NULL,
	"status" text NOT NULL,
	"release_date_time" timestamp with time zone,
	"release_date" text,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsroom_release_notes_releaseNoteId_unique" UNIQUE("release_note_id")
);
--> statement-breakpoint
CREATE TABLE "platform"."newsroom_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsroom_topics_topicId_unique" UNIQUE("topic_id"),
	CONSTRAINT "newsroom_topics_nameKey_unique" UNIQUE("name_key")
);
--> statement-breakpoint
CREATE TABLE "platform"."newsroom_user_states" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"newsroom_item_id" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"last_visited_at" timestamp with time zone,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "platform"."roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"resources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"include" text[] DEFAULT '{}' NOT NULL,
	"frontend_resources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."subscription_payment_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"settings_id" text NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"contact_phone" text DEFAULT '' NOT NULL,
	"methods" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_payment_settings_settingsId_unique" UNIQUE("settings_id")
);
--> statement-breakpoint
CREATE TABLE "platform"."subscription_renewal_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"tenant_name" text,
	"requested_by_id" text NOT NULL,
	"requested_by_name" text NOT NULL,
	"current_expiration_date" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_id" text,
	"reviewed_by_name" text,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_renewal_requests_requestId_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "platform"."tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"status" text NOT NULL,
	"accessible_pages" text[] DEFAULT '{}' NOT NULL,
	"offline_enabled" boolean DEFAULT true NOT NULL,
	"invoice_ai_monthly_limit" integer,
	"invoice_ai_activated_at" timestamp with time zone,
	"invoice_ai_period_start" timestamp with time zone,
	"invoice_ai_used_in_period" integer,
	"invoice_ai_carry_over" integer,
	"product_import_status" text,
	"subscription_start_date" timestamp with time zone,
	"subscription_renewal_date" timestamp with time zone,
	"subscription_status" text,
	"subscription_renewal_enabled" boolean,
	"subscription_last_renewal_date" timestamp with time zone,
	"subscription_notified_for_date" text,
	"subscription_created_at" timestamp with time zone,
	"subscription_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_tenantId_unique" UNIQUE("tenant_id"),
	CONSTRAINT "tenants_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "platform"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text NOT NULL,
	"token_version" integer,
	"avatar_color_id" integer,
	"warehouse_ids" text[],
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."brands" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"brand_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "store"."buying_invoice_currency_amounts" (
	"buying_invoice_row_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"position" integer NOT NULL,
	"currency_id" text NOT NULL,
	"name" text NOT NULL,
	"internal_code" text,
	"exchange_rate" numeric NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"amount" numeric NOT NULL,
	"paid_amount" numeric NOT NULL,
	"remaining_amount" numeric NOT NULL,
	"subtotal" numeric NOT NULL,
	"tax" numeric NOT NULL,
	"discount" numeric NOT NULL,
	CONSTRAINT "buying_invoice_currency_amounts_buying_invoice_row_id_position_pk" PRIMARY KEY("buying_invoice_row_id","position")
);
--> statement-breakpoint
CREATE TABLE "store"."buying_invoice_items" (
	"buying_invoice_row_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"position" integer NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"barcode" text,
	"quantity" numeric NOT NULL,
	"unit" text,
	"unit_price" numeric NOT NULL,
	"discount" numeric,
	"discount_is_percent" boolean,
	"tax_rate" numeric,
	"line_total" numeric,
	"source_name" text,
	CONSTRAINT "buying_invoice_items_buying_invoice_row_id_position_pk" PRIMARY KEY("buying_invoice_row_id","position")
);
--> statement-breakpoint
CREATE TABLE "store"."buying_invoice_tenders" (
	"buying_invoice_row_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"position" integer NOT NULL,
	"currency_id" text NOT NULL,
	"tendered_amount" numeric NOT NULL,
	"applied_amount" numeric NOT NULL,
	"change_amount" numeric NOT NULL,
	CONSTRAINT "buying_invoice_tenders_buying_invoice_row_id_position_pk" PRIMARY KEY("buying_invoice_row_id","position")
);
--> statement-breakpoint
CREATE TABLE "store"."buying_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invoice_number" text,
	"payment_type" text,
	"status" text,
	"payment_status" text,
	"invoice_currency_id" text,
	"cash_account_type" text,
	"notes" text,
	"invoice_discount" numeric,
	"invoice_discount_is_percent" boolean,
	"warehouse_id" text,
	"issued_at" timestamp with time zone,
	"buying_invoice_id" text,
	"supplier_id" text,
	"supplier_name" text,
	"supplier_invoice_number" text,
	"source_supplier_name" text
);
--> statement-breakpoint
CREATE TABLE "store"."cash_account_balances" (
	"tenant_id" text NOT NULL,
	"cash_account_id" text NOT NULL,
	"currency_id" text NOT NULL,
	"amount" numeric NOT NULL,
	CONSTRAINT "cash_account_balances_tenant_id_cash_account_id_currency_id_pk" PRIMARY KEY("tenant_id","cash_account_id","currency_id")
);
--> statement-breakpoint
CREATE TABLE "store"."cash_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cash_account_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"allow_negative_balance" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."cash_ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ledger_entry_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"cash_account_id" text NOT NULL,
	"account_type" text NOT NULL,
	"currency_id" text NOT NULL,
	"amount" numeric NOT NULL,
	"movement_type" text NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"transfer_group_id" text,
	"reverses_ledger_entry_id" text,
	"reason" text,
	"from_exchange_rate_to_primary" numeric,
	"to_exchange_rate_to_primary" numeric
);
--> statement-breakpoint
CREATE TABLE "store"."categories" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_category_id" text
);
--> statement-breakpoint
CREATE TABLE "store"."currencies" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"currency_id" text NOT NULL,
	"name" text NOT NULL,
	"internal_code" text
);
--> statement-breakpoint
CREATE TABLE "store"."currency_setting_items" (
	"tenant_id" text NOT NULL,
	"currency_id" text NOT NULL,
	"is_primary" boolean NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"internal_code" text,
	"exchange_rate" numeric,
	"exchange_rate_unit_currency_id" text,
	CONSTRAINT "currency_setting_items_tenant_id_currency_id_pk" PRIMARY KEY("tenant_id","currency_id")
);
--> statement-breakpoint
CREATE TABLE "store"."currency_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "currency_settings_tenantId_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "store"."customers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"internal_code" text,
	"email" text,
	"phone" text,
	"country" text,
	"customer_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."daily_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action_id" text,
	"entry_type" text,
	"warehouse_id" text,
	"product_id" text,
	"invoice_number" text,
	"invoice_date" timestamp with time zone,
	"product_name" text,
	"supplier_id" text,
	"supplier_name" text,
	"partner_id" text,
	"partner_name" text,
	"customer_id" text,
	"customer_name" text,
	"project_id" text,
	"employee_id" text,
	"employee_name" text,
	"expense_id" text,
	"expense_name" text,
	"currency_id" text,
	"currency_name" text,
	"exchange_rate_to_primary" numeric,
	"cash_account_type" text,
	"unit_id" text,
	"unit_name" text,
	"weight" text,
	"single_unit_price" text,
	"total_price" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "store"."employee_payouts" (
	"tenant_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"payout_id" text NOT NULL,
	"position" integer NOT NULL,
	"date" date NOT NULL,
	"amount" numeric NOT NULL,
	"currency_id" text NOT NULL,
	"currency_name" text NOT NULL,
	"note" text,
	CONSTRAINT "employee_payouts_tenant_id_payout_id_pk" PRIMARY KEY("tenant_id","payout_id")
);
--> statement-breakpoint
CREATE TABLE "store"."employee_salaries" (
	"tenant_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"salary_id" text NOT NULL,
	"position" integer NOT NULL,
	"type" text NOT NULL,
	"amount" numeric NOT NULL,
	"currency_id" text NOT NULL,
	"currency_name" text NOT NULL,
	"effective_date" date NOT NULL,
	"overtime_rate" numeric,
	CONSTRAINT "employee_salaries_tenant_id_salary_id_pk" PRIMARY KEY("tenant_id","salary_id")
);
--> statement-breakpoint
CREATE TABLE "store"."employees" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"employee_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"status" text DEFAULT 'active' NOT NULL,
	"employment_type" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"working_days" text[] DEFAULT '{}' NOT NULL,
	"work_start" text,
	"work_end" text
);
--> statement-breakpoint
CREATE TABLE "store"."expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expense_id" text NOT NULL,
	"name" text NOT NULL,
	"internal_code" text
);
--> statement-breakpoint
CREATE TABLE "store"."inventories" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inventory_id" text NOT NULL,
	"product_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"shelf_id" text,
	"quantity" numeric,
	"average_cost" numeric,
	"min_quantity" numeric,
	"max_quantity" numeric,
	"reserved_quantity" numeric,
	"available_quantity" numeric,
	"last_count_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "store"."invoice_currency_amounts" (
	"invoice_row_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"position" integer NOT NULL,
	"currency_id" text NOT NULL,
	"name" text NOT NULL,
	"internal_code" text,
	"exchange_rate" numeric NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"amount" numeric NOT NULL,
	"paid_amount" numeric NOT NULL,
	"remaining_amount" numeric NOT NULL,
	"subtotal" numeric NOT NULL,
	"tax" numeric NOT NULL,
	"discount" numeric NOT NULL,
	CONSTRAINT "invoice_currency_amounts_invoice_row_id_position_pk" PRIMARY KEY("invoice_row_id","position")
);
--> statement-breakpoint
CREATE TABLE "store"."invoice_items" (
	"invoice_row_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"position" integer NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"barcode" text,
	"quantity" numeric NOT NULL,
	"unit" text,
	"unit_price" numeric NOT NULL,
	"discount" numeric,
	"discount_is_percent" boolean,
	"tax_rate" numeric,
	"line_total" numeric,
	CONSTRAINT "invoice_items_invoice_row_id_position_pk" PRIMARY KEY("invoice_row_id","position")
);
--> statement-breakpoint
CREATE TABLE "store"."invoice_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"no_merge_invoice_lines" boolean,
	"allow_oversell" boolean,
	"display_name" text,
	"address" text,
	"phone" text,
	"email" text,
	"tax_number" text,
	"logo_url" text,
	"qr_url" text,
	"footer_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_settings_tenantId_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "store"."invoice_tenders" (
	"invoice_row_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"position" integer NOT NULL,
	"currency_id" text NOT NULL,
	"tendered_amount" numeric NOT NULL,
	"applied_amount" numeric NOT NULL,
	"change_amount" numeric NOT NULL,
	CONSTRAINT "invoice_tenders_invoice_row_id_position_pk" PRIMARY KEY("invoice_row_id","position")
);
--> statement-breakpoint
CREATE TABLE "store"."invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invoice_number" text,
	"payment_type" text,
	"status" text,
	"payment_status" text,
	"invoice_currency_id" text,
	"cash_account_type" text,
	"notes" text,
	"invoice_discount" numeric,
	"invoice_discount_is_percent" boolean,
	"warehouse_id" text,
	"issued_at" timestamp with time zone,
	"invoice_id" text,
	"project_id" text,
	"customer_id" text,
	"customer_name" text,
	"sales_person" text,
	"print_after_payment" boolean
);
--> statement-breakpoint
CREATE TABLE "store"."label_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"template_id" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"layout" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."legacy_selling_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"selling_invoice_id" text NOT NULL,
	"customer_id" text,
	"invoice_number" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text,
	"payment_status" text,
	"paid_amount" numeric,
	"remaining_amount" numeric,
	"total_amount" numeric NOT NULL,
	"total_tax" numeric NOT NULL,
	"total_discount" numeric NOT NULL,
	"total_amount_after_discount" numeric NOT NULL,
	"total_amount_after_tax" numeric NOT NULL,
	"total_amount_after_discount_and_tax" numeric NOT NULL,
	"warehouse_id" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "store"."negative_quantity_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"run_at" timestamp with time zone,
	"product_ids" text[] DEFAULT '{}' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."notification_reads" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"run_at" timestamp with time zone NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."offline_sync_states" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"next_block_start" integer,
	"min_online_invoice_number" integer,
	"buying_next_block_start" integer,
	"min_online_buying_invoice_number" integer,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offline_sync_states_tenantId_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "store"."partners" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"internal_code" text,
	"email" text,
	"phone" text,
	"country" text,
	"partner_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."party_opening_balances" (
	"tenant_id" text NOT NULL,
	"party_type" text NOT NULL,
	"party_id" text NOT NULL,
	"position" integer NOT NULL,
	"currency_id" text NOT NULL,
	"currency_code" text NOT NULL,
	"amount" numeric NOT NULL,
	"direction" text NOT NULL,
	CONSTRAINT "party_opening_balances_tenant_id_party_type_party_id_position_pk" PRIMARY KEY("tenant_id","party_type","party_id","position")
);
--> statement-breakpoint
CREATE TABLE "store"."product_import_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"session_id" text NOT NULL,
	"status" text,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mapping" jsonb,
	"selected_fields" text[],
	"master_resolutions" jsonb,
	"created_master_data" jsonb,
	"currency" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_import_sessions_sessionId_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "store"."products" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"latin_name" text,
	"barcode" text,
	"additional_barcodes" text[],
	"internal_code" text,
	"product_factory_code" text,
	"category_id" text,
	"supplier_id" text,
	"brand_id" text,
	"tax_rate" text,
	"unit_id" text,
	"purchase_price" numeric,
	"retail_price" numeric NOT NULL,
	"wholesale_price" numeric,
	"semi_wholesale_price" numeric,
	"discount" numeric,
	"price_currency" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"attributes" jsonb,
	"images" text[],
	"description" text,
	"aliases" text[]
);
--> statement-breakpoint
CREATE TABLE "store"."projects" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" text NOT NULL,
	"internal_code" text,
	"name" text NOT NULL,
	"contract_cost" numeric
);
--> statement-breakpoint
CREATE TABLE "store"."reports" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"report_id" text,
	"name" text,
	"type" text,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"data" jsonb,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."shelves" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shelf_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "store"."stock_movings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stock_moving_id" text NOT NULL,
	"product_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric NOT NULL,
	"unit_cost" numeric,
	"reference_type" text NOT NULL,
	"reference_id" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "store"."suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"internal_code" text,
	"email" text,
	"phone" text,
	"country" text,
	"supplier_id" text NOT NULL,
	"vat_id" text,
	"aliases" text[]
);
--> statement-breakpoint
CREATE TABLE "store"."sync_mutations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_mutation_id" text NOT NULL,
	"entity" text NOT NULL,
	"operation" text NOT NULL,
	"result" jsonb,
	"error" text,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."tenant_role_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"role" text NOT NULL,
	"see" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."units" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unit_id" text NOT NULL,
	"name" text NOT NULL,
	"internal_code" text
);
--> statement-breakpoint
CREATE TABLE "store"."user_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"products_per_page" integer,
	"display_language" text,
	"default_invoice_currency_id" text,
	"column_configs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."warehouses" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"created_by_role" text,
	"created_by_at" timestamp with time zone,
	"updated_by_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"updated_by_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"warehouse_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"address" text,
	"status" text DEFAULT 'active' NOT NULL,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "store"."buying_invoice_currency_amounts" ADD CONSTRAINT "buying_invoice_currency_amounts_buying_invoice_row_id_buying_invoices_id_fk" FOREIGN KEY ("buying_invoice_row_id") REFERENCES "store"."buying_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."buying_invoice_items" ADD CONSTRAINT "buying_invoice_items_buying_invoice_row_id_buying_invoices_id_fk" FOREIGN KEY ("buying_invoice_row_id") REFERENCES "store"."buying_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."buying_invoice_tenders" ADD CONSTRAINT "buying_invoice_tenders_buying_invoice_row_id_buying_invoices_id_fk" FOREIGN KEY ("buying_invoice_row_id") REFERENCES "store"."buying_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."invoice_currency_amounts" ADD CONSTRAINT "invoice_currency_amounts_invoice_row_id_invoices_id_fk" FOREIGN KEY ("invoice_row_id") REFERENCES "store"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."invoice_items" ADD CONSTRAINT "invoice_items_invoice_row_id_invoices_id_fk" FOREIGN KEY ("invoice_row_id") REFERENCES "store"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."invoice_tenders" ADD CONSTRAINT "invoice_tenders_invoice_row_id_invoices_id_fk" FOREIGN KEY ("invoice_row_id") REFERENCES "store"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "newsroom_changes_release_note_id_index" ON "platform"."newsroom_changes" USING btree ("release_note_id");--> statement-breakpoint
CREATE INDEX "newsroom_changes_topic_id_index" ON "platform"."newsroom_changes" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "newsroom_release_notes_status_release_date_time_index" ON "platform"."newsroom_release_notes" USING btree ("status","release_date_time");--> statement-breakpoint
CREATE UNIQUE INDEX "newsroom_user_states_user_id_newsroom_item_id_index" ON "platform"."newsroom_user_states" USING btree ("user_id","newsroom_item_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_tenant_id_user_id_index" ON "platform"."refresh_tokens" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_renewal_requests_tenant_id_index" ON "platform"."subscription_renewal_requests" USING btree ("tenant_id") WHERE "platform"."subscription_renewal_requests"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_id_email_index" ON "platform"."users" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_id_user_id_index" ON "platform"."users" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_id_display_name_index" ON "platform"."users" USING btree ("tenant_id","display_name");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_tenant_id_brand_id_index" ON "store"."brands" USING btree ("tenant_id","brand_id");--> statement-breakpoint
CREATE INDEX "buying_invoice_items_tenant_id_product_id_index" ON "store"."buying_invoice_items" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "buying_invoices_tenant_id_buying_invoice_id_index" ON "store"."buying_invoices" USING btree ("tenant_id","buying_invoice_id");--> statement-breakpoint
CREATE INDEX "buying_invoices_tenant_id_invoice_number_index" ON "store"."buying_invoices" USING btree ("tenant_id","invoice_number");--> statement-breakpoint
CREATE INDEX "buying_invoices_tenant_id_warehouse_id_index" ON "store"."buying_invoices" USING btree ("tenant_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "buying_invoices_tenant_id_supplier_id_index" ON "store"."buying_invoices" USING btree ("tenant_id","supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_accounts_tenant_id_warehouse_id_type_index" ON "store"."cash_accounts" USING btree ("tenant_id","warehouse_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_accounts_tenant_id_cash_account_id_index" ON "store"."cash_accounts" USING btree ("tenant_id","cash_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_ledger_entries_tenant_id_idempotency_key_index" ON "store"."cash_ledger_entries" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_ledger_entries_tenant_id_ledger_entry_id_index" ON "store"."cash_ledger_entries" USING btree ("tenant_id","ledger_entry_id");--> statement-breakpoint
CREATE INDEX "cash_ledger_entries_tenant_id_reference_type_reference_id_index" ON "store"."cash_ledger_entries" USING btree ("tenant_id","reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "cash_ledger_entries_tenant_id_cash_account_id_created_at_index" ON "store"."cash_ledger_entries" USING btree ("tenant_id","cash_account_id","created_at");--> statement-breakpoint
CREATE INDEX "cash_ledger_entries_tenant_id_warehouse_id_account_type_created_at_index" ON "store"."cash_ledger_entries" USING btree ("tenant_id","warehouse_id","account_type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_tenant_id_category_id_index" ON "store"."categories" USING btree ("tenant_id","category_id");--> statement-breakpoint
CREATE INDEX "categories_tenant_id_parent_category_id_index" ON "store"."categories" USING btree ("tenant_id","parent_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "currencies_tenant_id_currency_id_index" ON "store"."currencies" USING btree ("tenant_id","currency_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_id_customer_id_index" ON "store"."customers" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "customers_tenant_id_name_index" ON "store"."customers" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_actions_tenant_id_action_id_index" ON "store"."daily_actions" USING btree ("tenant_id","action_id");--> statement-breakpoint
CREATE INDEX "daily_actions_tenant_id_entry_type_index" ON "store"."daily_actions" USING btree ("tenant_id","entry_type");--> statement-breakpoint
CREATE INDEX "daily_actions_tenant_id_warehouse_id_invoice_date_index" ON "store"."daily_actions" USING btree ("tenant_id","warehouse_id","invoice_date");--> statement-breakpoint
CREATE INDEX "daily_actions_tenant_id_created_at_index" ON "store"."daily_actions" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "employee_payouts_tenant_id_employee_id_index" ON "store"."employee_payouts" USING btree ("tenant_id","employee_id");--> statement-breakpoint
CREATE INDEX "employee_salaries_tenant_id_employee_id_index" ON "store"."employee_salaries" USING btree ("tenant_id","employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_tenant_id_employee_id_index" ON "store"."employees" USING btree ("tenant_id","employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_tenant_id_expense_id_index" ON "store"."expenses" USING btree ("tenant_id","expense_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventories_tenant_id_warehouse_id_product_id_index" ON "store"."inventories" USING btree ("tenant_id","warehouse_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventories_tenant_id_inventory_id_index" ON "store"."inventories" USING btree ("tenant_id","inventory_id");--> statement-breakpoint
CREATE INDEX "invoice_items_tenant_id_product_id_index" ON "store"."invoice_items" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_tenant_id_invoice_id_index" ON "store"."invoices" USING btree ("tenant_id","invoice_id");--> statement-breakpoint
CREATE INDEX "invoices_tenant_id_invoice_number_index" ON "store"."invoices" USING btree ("tenant_id","invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_tenant_id_warehouse_id_index" ON "store"."invoices" USING btree ("tenant_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "invoices_tenant_id_customer_id_index" ON "store"."invoices" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "label_templates_tenant_id_template_id_index" ON "store"."label_templates" USING btree ("tenant_id","template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "label_templates_tenant_id_index" ON "store"."label_templates" USING btree ("tenant_id") WHERE "store"."label_templates"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_selling_invoices_tenant_id_selling_invoice_id_index" ON "store"."legacy_selling_invoices" USING btree ("tenant_id","selling_invoice_id");--> statement-breakpoint
CREATE INDEX "legacy_selling_invoices_tenant_id_customer_id_index" ON "store"."legacy_selling_invoices" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "negative_quantity_snapshots_tenant_id_type_index" ON "store"."negative_quantity_snapshots" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_reads_tenant_id_user_id_run_at_type_index" ON "store"."notification_reads" USING btree ("tenant_id","user_id","run_at","type");--> statement-breakpoint
CREATE UNIQUE INDEX "partners_tenant_id_partner_id_index" ON "store"."partners" USING btree ("tenant_id","partner_id");--> statement-breakpoint
CREATE INDEX "partners_tenant_id_name_index" ON "store"."partners" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "product_import_sessions_tenant_id_index" ON "store"."product_import_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "product_import_sessions_expires_at_index" ON "store"."product_import_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_id_product_id_index" ON "store"."products" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE INDEX "products_tenant_id_status_name_index" ON "store"."products" USING btree ("tenant_id","status","name");--> statement-breakpoint
CREATE INDEX "products_tenant_id_barcode_index" ON "store"."products" USING btree ("tenant_id","barcode");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_tenant_id_project_id_index" ON "store"."projects" USING btree ("tenant_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_tenant_id_report_id_index" ON "store"."reports" USING btree ("tenant_id","report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shelves_tenant_id_shelf_id_index" ON "store"."shelves" USING btree ("tenant_id","shelf_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movings_tenant_id_stock_moving_id_index" ON "store"."stock_movings" USING btree ("tenant_id","stock_moving_id");--> statement-breakpoint
CREATE INDEX "stock_movings_tenant_id_product_id_index" ON "store"."stock_movings" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE INDEX "stock_movings_tenant_id_warehouse_id_index" ON "store"."stock_movings" USING btree ("tenant_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_movings_tenant_id_reference_type_reference_id_index" ON "store"."stock_movings" USING btree ("tenant_id","reference_type","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_tenant_id_supplier_id_index" ON "store"."suppliers" USING btree ("tenant_id","supplier_id");--> statement-breakpoint
CREATE INDEX "suppliers_tenant_id_name_index" ON "store"."suppliers" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_mutations_tenant_id_client_mutation_id_index" ON "store"."sync_mutations" USING btree ("tenant_id","client_mutation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_role_permissions_tenant_id_role_index" ON "store"."tenant_role_permissions" USING btree ("tenant_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "units_tenant_id_unit_id_index" ON "store"."units" USING btree ("tenant_id","unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_settings_tenant_id_user_id_index" ON "store"."user_settings" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_tenant_id_warehouse_id_index" ON "store"."warehouses" USING btree ("tenant_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouses_tenant_id_status_index" ON "store"."warehouses" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "warehouses_tenant_id_code_index" ON "store"."warehouses" USING btree ("tenant_id","code");