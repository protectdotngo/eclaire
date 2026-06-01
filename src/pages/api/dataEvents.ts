import "dotenv/config";
import type { APIRoute } from "astro";
import { eventsInTest } from "../../../drizzle/schema";
import { db } from "../../lib/dbDrizzle";
import { gte } from "drizzle-orm";

const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, "0");
const minDate = `${year}-${month}-01`;

export const GET: APIRoute = async () => {
  try {
    const result = await db
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
    console.log('Error:', err);
    return new Response(
      JSON.stringify({ message: "Database error", error: err }),
      {
        status: 500,
      },
    );
  }
};
