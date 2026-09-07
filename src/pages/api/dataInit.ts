import "dotenv/config";
import type { APIRoute } from "astro";
import { db } from "../../lib/dbDrizzle";
import { orgsInTest } from "../../../drizzle/schema";
import { getCached, setCached } from "../../lib/apiCache";

// Every visitor calls this on page load: cache the (rarely changing) org list
// so the DB sees at most one query per pod per minute instead of one per visit.
const CACHE_TTL_MS = 60_000;
const CACHE_KEY = "dataInit";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=0, s-maxage=60",
};

export const GET: APIRoute = async () => {
  const cached = getCached(CACHE_KEY, CACHE_TTL_MS);
  if (cached) {
    return new Response(cached, { status: 200, headers: JSON_HEADERS });
  }
  try {
    const result = await db
      .select({
        id: orgsInTest.id,
        name: orgsInTest.name,
        address: orgsInTest.address,
        city: orgsInTest.city,
        domain: orgsInTest.domain,
        categories: orgsInTest.categories,
        lat: orgsInTest.lat,
        lon: orgsInTest.lon,
        desc: orgsInTest.desc,
        rss: orgsInTest.rss,
        events_url: orgsInTest.eventsUrl,
        news_url: orgsInTest.newsUrl,
        socials: orgsInTest.socials,
        contact: orgsInTest.contact,
      })
      .from(orgsInTest);
    const body = JSON.stringify({ message: "Success", data: result });
    setCached(CACHE_KEY, body);
    return new Response(body, {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.log(err);
    return new Response(
      JSON.stringify({ message: "Database error", error: err }),
      {
        status: 500,
      },
    );
  }
};
