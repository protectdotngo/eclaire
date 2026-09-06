import {
  pgSchema,
  index,
  foreignKey,
  uuid,
  numeric,
  text,
  jsonb,
  timestamp,
  boolean,
  vector,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const test = pgSchema("test");

export const propositionVerificationsInTest = test.table(
  "proposition_verifications",
  {
    id: uuid().defaultRandom().notNull(),
    propositionId: uuid("proposition_id").notNull(),
    legitimacyScore: numeric("legitimacy_score", { precision: 3, scale: 1 }),
    verdict: text(),
    suspiciousChanges: jsonb("suspicious_changes"),
    confirmedByWeb: text("confirmed_by_web").array(),
    notes: text(),
    processingStatus: text("processing_status").default("completed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_verification_proposition").using(
      "btree",
      table.propositionId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_verification_verdict").using(
      "btree",
      table.verdict.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.propositionId],
      foreignColumns: [propositionsInTest.id],
      name: "proposition_verifications_proposition_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const propositionsInTest = test.table(
  "propositions",
  {
    id: uuid().defaultRandom().notNull(),
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    approved: boolean().default(false).notNull(),
    submitterType: text("submitter_type"),
    action: text(),
    modifyingOrgId: uuid("modifying_org_id"),
    submitterName: text("submitter_name"),
    submitterEmail: text("submitter_email"),
    name: text(),
    desc: text(),
    categories: text().array(),
    domain: text(),
    address: text(),
    city: text(),
    rss: text(),
    eventsUrl: text("events_url"),
    newsUrl: text("news_url"),
    socials: text().array(),
    contact: text().array(),
    status: text().default("pending").notNull(),
    originalSubmission: jsonb("original_submission"),
    adminEditedAt: timestamp("admin_edited_at", {
      withTimezone: true,
      mode: "string",
    }),
    adminEditor: text("admin_editor"),
  },
  (table) => [
    foreignKey({
      columns: [table.modifyingOrgId],
      foreignColumns: [orgsInTest.id],
      name: "propositions_modifying_org_id_foreign",
    }).onDelete("set null"),
  ],
);

export const orgsNewsInTest = test.table(
  "orgs_news",
  {
    orgId: uuid("org_id").notNull(),
    newsId: uuid("news_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgsInTest.id],
      name: "orgs_news_org_id_foreign",
    }),
    foreignKey({
      columns: [table.newsId],
      foreignColumns: [newsInTest.id],
      name: "orgs_news_news_id_foreign",
    }),
  ],
);

export const orgsEventsInTest = test.table(
  "orgs_events",
  {
    orgId: uuid("org_id").notNull(),
    eventId: uuid("event_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgsInTest.id],
      name: "orgs_events_org_id_foreign",
    }),
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [eventsInTest.id],
      name: "orgs_events_event_id_foreign",
    }).onDelete("cascade"),
  ],
);

export const eventsInTest = test.table("events", {
  id: uuid().defaultRandom().notNull(),
  url: text().notNull(),
  title: text(),
  content: text(),
  location: text(),
  scrapedAt: timestamp("scraped_at", { mode: "string" }).defaultNow().notNull(),
  embedding: vector({ dimensions: 1024 }),
  startDate: timestamp("start_date", { mode: "string" }),
  endDate: timestamp("end_date", { mode: "string" }),
  categories: text().array(),
  baseUrl: text("base_url"),
});

export const orgsInTest = test.table("orgs", {
  id: uuid().defaultRandom().notNull(),
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
  contact: text().array(),
});

export const newsInTest = test.table("news", {
  id: uuid().defaultRandom().notNull(),
  url: text().notNull(),
  title: text(),
  content: text(),
  pubDate: timestamp("pub_date", { mode: "string" }),
  scrapedAt: timestamp("scraped_at", { mode: "string" }).defaultNow().notNull(),
  embedding: vector({ dimensions: 1024 }),
});

export const promptConfigInTest = test.table("prompt_config", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  content: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});
