import { relations } from "drizzle-orm/relations";
import {
  propositionsInTest,
  propositionVerificationsInTest,
  orgsInTest,
  orgsNewsInTest,
  newsInTest,
  orgsEventsInTest,
  eventsInTest,
} from "./schema";

export const propositionVerificationsInTestRelations = relations(
  propositionVerificationsInTest,
  ({ one }) => ({
    propositionsInTest: one(propositionsInTest, {
      fields: [propositionVerificationsInTest.propositionId],
      references: [propositionsInTest.id],
    }),
  }),
);

export const propositionsInTestRelations = relations(
  propositionsInTest,
  ({ one, many }) => ({
    propositionVerificationsInTests: many(propositionVerificationsInTest),
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
