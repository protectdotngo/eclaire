import "dotenv/config";
import type { APIRoute } from "astro";
import { eventsInTest, orgsEventsInTest } from "../../../drizzle/schema";
import { db } from "../../lib/dbDrizzle";
import { gte, and, eq, inArray } from "drizzle-orm";
import { getCached, setCached } from "../../lib/apiCache";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cache per (org, all) combination: the no-param variant is hit by every
// visitor on page load and was the main DB load during the load test.
const CACHE_TTL_MS = 60_000;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=0, s-maxage=60",
};

export const GET: APIRoute = async ({ url }) => {
  const orgId = url.searchParams.get("org");
  const includeAll = url.searchParams.get("all") === "true";

  if (orgId !== null && !UUID_REGEX.test(orgId)) {
    return new Response(JSON.stringify({ message: "Invalid org id format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cacheKey = `dataEvents:${orgId ?? ""}:${includeAll}`;
  const cached = getCached(cacheKey, CACHE_TTL_MS);
  if (cached) {
    return new Response(cached, { status: 200, headers: JSON_HEADERS });
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
            startDate: eventsInTest.startDate,
            endDate: eventsInTest.endDate,
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
            startDate: eventsInTest.startDate,
            endDate: eventsInTest.endDate,
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

    const body = JSON.stringify({ message: "Success", data: dataWithOrgs });
    setCached(cacheKey, body);
    return new Response(body, {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.log("Error:", err);
    return new Response(
      JSON.stringify({ message: "Database error", error: err }),
      { status: 500 },
    );
  }
};
