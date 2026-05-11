-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE SCHEMA "test";
--> statement-breakpoint
CREATE TABLE "test"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"content" text,
	"date" timestamp(0),
	"location" text,
	"scraped_at" timestamp(0) DEFAULT now() NOT NULL,
	"embedding" vector(1024),
	CONSTRAINT "events_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "test"."orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"desc" text NOT NULL,
	"category" text[] NOT NULL,
	"domain" text,
	"events_url" text,
	"news_url" text,
	"socials" text[],
	"address" text,
	"lat" double precision,
	"lon" double precision,
	"embedding" vector(1024),
	"city" text,
	CONSTRAINT "orgs_name_unique" UNIQUE("name"),
	CONSTRAINT "orgs_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "test"."news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"content" text,
	"pub_date" timestamp(0),
	"scraped_at" timestamp(0) DEFAULT now() NOT NULL,
	"embedding" vector(1024),
	CONSTRAINT "news_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "test"."events" ADD CONSTRAINT "events_org_id_foreign" FOREIGN KEY ("org_id") REFERENCES "test"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test"."news" ADD CONSTRAINT "news_org_id_foreign" FOREIGN KEY ("org_id") REFERENCES "test"."orgs"("id") ON DELETE cascade ON UPDATE no action;
*/