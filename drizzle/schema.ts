import { pgTable, pgSchema, unique, uuid, text, timestamp, vector, doublePrecision, foreignKey, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const test = pgSchema("test");


export const eventsInTest = test.table("events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	url: text().notNull(),
	title: text(),
	content: text(),
	location: text(),
	scrapedAt: timestamp("scraped_at", { mode: 'string' }).defaultNow().notNull(),
	embedding: vector({ dimensions: 1024 }),
	startDate: timestamp("start_date", { mode: 'string' }),
	endDate: timestamp("end_date", { mode: 'string' }),
}, (table) => [
	unique("events_url_unique").on(table.url),
]);

export const newsInTest = test.table("news", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	url: text().notNull(),
	title: text(),
	content: text(),
	pubDate: timestamp("pub_date", { mode: 'string' }),
	scrapedAt: timestamp("scraped_at", { mode: 'string' }).defaultNow().notNull(),
	embedding: vector({ dimensions: 1024 }),
}, (table) => [
	unique("news_url_unique").on(table.url),
]);

export const orgsInTest = test.table("orgs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	desc: text().notNull(),
	categories: text().array().notNull(),
	domain: text(),
	eventsUrl: text("events_url"),
	newsUrl: text("news_url"),
	socials: text().array(),
	address: text(),
	lat: doublePrecision(),
	lon: doublePrecision(),
	embedding: vector({ dimensions: 1024 }),
	city: text(),
	rss: text(),
}, (table) => [
	unique("orgs_name_address_unique").on(table.name, table.address),
]);

export const orgsNewsInTest = test.table("orgs_news", {
	orgId: uuid("org_id").notNull(),
	newsId: uuid("news_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [orgsInTest.id],
			name: "orgs_news_org_id_foreign"
		}),
	foreignKey({
			columns: [table.newsId],
			foreignColumns: [newsInTest.id],
			name: "orgs_news_news_id_foreign"
		}),
	primaryKey({ columns: [table.orgId, table.newsId], name: "orgs_news_pkey"}),
]);

export const orgsEventsInTest = test.table("orgs_events", {
	orgId: uuid("org_id").notNull(),
	eventId: uuid("event_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [orgsInTest.id],
			name: "orgs_events_org_id_foreign"
		}),
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [eventsInTest.id],
			name: "orgs_events_event_id_foreign"
		}),
	primaryKey({ columns: [table.orgId, table.eventId], name: "orgs_events_pkey"}),
]);
