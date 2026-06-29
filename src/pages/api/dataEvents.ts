import "dotenv/config";
import type { APIRoute } from "astro";
import { eventsInTest, orgsEventsInTest } from "../../../drizzle/schema";
import { db } from "../../lib/dbDrizzle";
import { gte, and, eq, inArray } from "drizzle-orm";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: APIRoute = async ({ url }) => {
  const orgId = url.searchParams.get("org");
  const includeAll = url.searchParams.get("all") === "true";

  if (orgId !== null && !UUID_REGEX.test(orgId)) {
    return new Response(JSON.stringify({ message: "Invalid org id format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const minDate = `${year}-${month}-01`;

  try {
    const conditions: any[] = [];
    if (orgId) conditions.push(eq(orgsEventsInTest.orgId, orgId));
    if (!includeAll) conditions.push(gte(eventsInTest.startDate, minDate));

    const result = orgId
      ? await db
          .select({
            id: eventsInTest.id,
            url: eventsInTest.url,
            title: eventsInTest.title,
            content: eventsInTest.content,
            start_date: eventsInTest.startDate,
            end_date: eventsInTest.endDate,
            location: eventsInTest.location,
            categories: eventsInTest.categories,
          })
          .from(eventsInTest)
          .innerJoin(
            orgsEventsInTest,
            eq(orgsEventsInTest.eventId, eventsInTest.id),
          )
          .where(conditions.length ? and(...conditions) : undefined)
      : await db
          .select({
            id: eventsInTest.id,
            url: eventsInTest.url,
            title: eventsInTest.title,
            content: eventsInTest.content,
            start_date: eventsInTest.startDate,
            end_date: eventsInTest.endDate,
            location: eventsInTest.location,
            categories: eventsInTest.categories,
          })
          .from(eventsInTest)
          .where(conditions.length ? and(...conditions) : undefined);

    let dataWithOrgs = result.map((e) => ({ ...e, org_ids: [] as string[] }));
    if (result.length > 0) {
      const eventIds = result.map((e) => e.id);
      const links = await db
        .select({
          eventId: orgsEventsInTest.eventId,
          orgId: orgsEventsInTest.orgId,
        })
        .from(orgsEventsInTest)
        .where(inArray(orgsEventsInTest.eventId, eventIds));

      const orgsByEvent = new Map<string, string[]>();
      for (const link of links) {
        if (!orgsByEvent.has(link.eventId)) {
          orgsByEvent.set(link.eventId, []);
        }
        orgsByEvent.get(link.eventId)!.push(link.orgId);
      }
      dataWithOrgs = result.map((e) => ({
        ...e,
        org_ids: orgsByEvent.get(e.id) ?? [],
      }));
    }

    return new Response(
      JSON.stringify({ message: "Success", data: dataWithOrgs }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.log("Error:", err);
    return new Response(
      JSON.stringify({ message: "Database error", error: err }),
      { status: 500 },
    );
  }
};
