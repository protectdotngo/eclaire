import { relations } from "drizzle-orm/relations";
import {
  orgsInTest,
  propositionsInTest,
  orgsNewsInTest,
  newsInTest,
  orgsEventsInTest,
  eventsInTest,
} from "./schema";

export const propositionsInTestRelations = relations(
  propositionsInTest,
  ({ one }) => ({
    orgsInTest: one(orgsInTest, {
      fields: [propositionsInTest.modifyingOrgId],
      references: [orgsInTest.id],
    }),
  }),
);

export const orgsInTestRelations = relations(orgsInTest, ({ many }) => ({
  propositionsInTests: many(propositionsInTest),
  orgsNewsInTests: many(orgsNewsInTest),
  orgsEventsInTests: many(orgsEventsInTest),
}));

export const orgsNewsInTestRelations = relations(orgsNewsInTest, ({ one }) => ({
  orgsInTest: one(orgsInTest, {
    fields: [orgsNewsInTest.orgId],
    references: [orgsInTest.id],
  }),
  newsInTest: one(newsInTest, {
    fields: [orgsNewsInTest.newsId],
    references: [newsInTest.id],
  }),
}));

export const newsInTestRelations = relations(newsInTest, ({ many }) => ({
  orgsNewsInTests: many(orgsNewsInTest),
}));

export const orgsEventsInTestRelations = relations(
  orgsEventsInTest,
  ({ one }) => ({
    orgsInTest: one(orgsInTest, {
      fields: [orgsEventsInTest.orgId],
      references: [orgsInTest.id],
    }),
    eventsInTest: one(eventsInTest, {
      fields: [orgsEventsInTest.eventId],
      references: [eventsInTest.id],
    }),
  }),
);

export const eventsInTestRelations = relations(eventsInTest, ({ many }) => ({
  orgsEventsInTests: many(orgsEventsInTest),
}));
