import "dotenv/config";
import type { APIRoute } from "astro";
import { eventsInTest, orgsEventsInTest } from "../../../drizzle/schema";
import { db } from "../../lib/dbDrizzle";
import { gte, and, eq } from "drizzle-orm";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, "0");
const minDate = `${year}-${month}-01`;

export const GET: APIRoute = async ({ url }) => {
  const orgId = url.searchParams.get("org");
  if (orgId !== null && !UUID_REGEX.test(orgId)) {
    return new Response(JSON.stringify({ message: "Invalid org id format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
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
          .where(
            and(
              eq(orgsEventsInTest.orgId, orgId),
              gte(eventsInTest.startDate, minDate),
            ),
          )
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
          .where(gte(eventsInTest.startDate, minDate));
    return new Response(JSON.stringify({ message: "Success", data: result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.log("Error:", err);
    return new Response(
      JSON.stringify({ message: "Database error", error: err }),
      {
        status: 500,
      },
    );
  }
};
