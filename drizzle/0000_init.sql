CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."resolution" AS ENUM('refund', 'replacement', 'store_credit');--> statement-breakpoint
CREATE TYPE "public"."return_reason" AS ENUM('damaged', 'wrong_item', 'size_issue', 'not_as_described', 'changed_mind');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('open', 'in_review', 'approved', 'rejected', 'completed');--> statement-breakpoint
CREATE SEQUENCE "public"."return_request_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "customers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"sku" text NOT NULL,
	"product_name" text NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "order_items_order_id_sku_key" UNIQUE("order_id","sku"),
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_unit_price_non_negative" CHECK ("order_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_number" text NOT NULL,
	"customer_id" integer NOT NULL,
	"placed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "return_notes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "return_notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"return_request_id" integer NOT NULL,
	"author" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_notes_body_not_blank" CHECK (length(btrim("return_notes"."body")) > 0),
	CONSTRAINT "return_notes_author_not_blank" CHECK (length(btrim("return_notes"."author")) > 0)
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "return_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reference" text DEFAULT ('RD-' || lpad(nextval('return_request_reference_seq')::text, 6, '0')) NOT NULL,
	"order_item_id" integer NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text,
	"quantity" integer NOT NULL,
	"reason" "return_reason" NOT NULL,
	"status" "return_status" DEFAULT 'open' NOT NULL,
	"resolution" "resolution",
	"refund_amount" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "return_requests_reference_unique" UNIQUE("reference"),
	CONSTRAINT "return_requests_quantity_positive" CHECK ("return_requests"."quantity" > 0),
	CONSTRAINT "return_requests_refund_amount_matches_resolution" CHECK (("return_requests"."resolution" = 'refund' AND "return_requests"."refund_amount" > 0)
          OR ("return_requests"."resolution" IS DISTINCT FROM 'refund' AND "return_requests"."refund_amount" IS NULL)),
	CONSTRAINT "return_requests_resolution_matches_status" CHECK (("return_requests"."status" IN ('approved', 'completed')) = ("return_requests"."resolution" IS NOT NULL)),
	CONSTRAINT "return_requests_removed_only_when_open_or_rejected" CHECK ("return_requests"."deleted_at" IS NULL OR "return_requests"."status" IN ('open', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "return_status_changes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "return_status_changes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"return_request_id" integer NOT NULL,
	"from_status" "return_status" NOT NULL,
	"to_status" "return_status" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_notes" ADD CONSTRAINT "return_notes_return_request_id_return_requests_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_status_changes" ADD CONSTRAINT "return_status_changes_return_request_id_return_requests_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_order_number_trgm_idx" ON "orders" USING gin ("order_number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "return_notes_request_created_idx" ON "return_notes" USING btree ("return_request_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "return_requests_one_live_per_order_item" ON "return_requests" USING btree ("order_item_id") WHERE "return_requests"."status" IN ('open', 'in_review', 'approved') AND "return_requests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "return_requests_active_created_at_idx" ON "return_requests" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "return_requests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "return_requests_status_idx" ON "return_requests" USING btree ("status") WHERE "return_requests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "return_requests_reason_idx" ON "return_requests" USING btree ("reason") WHERE "return_requests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "return_requests_reference_trgm_idx" ON "return_requests" USING gin ("reference" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "return_requests_customer_name_trgm_idx" ON "return_requests" USING gin ("customer_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "return_requests_customer_email_trgm_idx" ON "return_requests" USING gin ("customer_email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "return_status_changes_request_idx" ON "return_status_changes" USING btree ("return_request_id","changed_at");