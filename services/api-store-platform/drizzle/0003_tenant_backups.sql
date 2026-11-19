CREATE TABLE "platform"."tenant_backup_states" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"data_version" integer DEFAULT 0 NOT NULL,
	"last_backup_version" integer DEFAULT -1 NOT NULL,
	"last_backup_at" timestamp with time zone,
	"last_backup_status" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"provider" text,
	"connections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"restore" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."tenant_backups" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"data_version" integer,
	"storage_id" text,
	"size" bigint,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform"."tenants" ADD COLUMN "backup_restore_started_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "tenant_backups_status_created_at_index" ON "platform"."tenant_backups" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "tenant_backups_tenant_id_status_completed_at_index" ON "platform"."tenant_backups" USING btree ("tenant_id","status","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_backups_one_in_flight" ON "platform"."tenant_backups" USING btree ("tenant_id") WHERE "platform"."tenant_backups"."kind" <> 'safety' and "platform"."tenant_backups"."status" in ('PENDING', 'PROCESSING', 'UPLOADING');