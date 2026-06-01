import "dotenv/config";
import type { APIRoute } from "astro";
import { sql, desc, gt } from "drizzle-orm";
import {
  orgsInTest,
  eventsInTest,
  newsInTest,
  orgsNewsInTest,
  orgsEventsInTest,
} from "../../../drizzle/schema";
import { db } from "../../lib/dbDrizzle";

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();
  const search = data.get("search");

  if (!search || typeof search !== "string") {
    return new Response(JSON.stringify({ message: "Invalid search" }), {
      status: 400,
    });
  }

  const response = await fetch(import.meta.env.SCW_API_LNK, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${import.meta.env.SCW_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dimensions: 1024,
      input: search,
      model: "qwen3-embedding-8b",
    }),
  });
  const res = await response.json();
  const queryVector = res.data[0].embedding;
  const vectorLiteral = JSON.stringify(queryVector);

  try {
    const queryVec = sql`${vectorLiteral}::vector`;
    const orgSim = sql<number>`(1 - (${orgsInTest.embedding} <=> ${queryVec}))`;

    const newsScore = sql<number>`COALESCE((
      SELECT 1 - MIN(${newsInTest.embedding} <=> ${queryVec})
      FROM ${newsInTest}
      JOIN ${orgsNewsInTest} ON ${orgsNewsInTest.newsId} = ${newsInTest.id}
      WHERE ${orgsNewsInTest.orgId} = ${orgsInTest.id}
    ), 0)`;

    const eventsScore = sql<number>`COALESCE((
      SELECT 1 - MIN(${eventsInTest.embedding} <=> ${queryVec})
      FROM ${eventsInTest}
      JOIN ${orgsEventsInTest} ON ${orgsEventsInTest.eventId} = ${eventsInTest.id}
      WHERE ${orgsEventsInTest.orgId} = ${orgsInTest.id}
    ), 0)`;

    const topNews = sql<any>`(
      SELECT jsonb_agg(jsonb_build_object('title', n.title, 'url', n.url, 'content', n.content))
      FROM (
        SELECT ${newsInTest.title} AS title, ${newsInTest.url} AS url, ${newsInTest.content} AS content
        FROM ${newsInTest}
        JOIN ${orgsNewsInTest} ON ${orgsNewsInTest.newsId} = ${newsInTest.id}
        WHERE ${orgsNewsInTest.orgId} = ${orgsInTest.id}
        ORDER BY ${newsInTest.embedding} <=> ${queryVec}
        LIMIT 5
      ) n
    )`;

    const topEvents = sql<any>`(
      SELECT jsonb_agg(jsonb_build_object('title', e.title, 'url', e.url, 'content', e.content, 'start_date', e.start_date, 'end_date', e.end_date, 'location', e.location))
      FROM (
        SELECT ${eventsInTest.title} AS title, ${eventsInTest.url} AS url, ${eventsInTest.content} AS content, ${eventsInTest.startDate} AS start_date, ${eventsInTest.endDate} AS end_date, ${eventsInTest.location} AS location
        FROM ${eventsInTest}
        JOIN ${orgsEventsInTest} ON ${orgsEventsInTest.eventId} = ${eventsInTest.id}
        WHERE ${orgsEventsInTest.orgId} = ${orgsInTest.id}
        ORDER BY ${eventsInTest.embedding} <=> ${queryVec}
        LIMIT 5
      ) e
    )`;

    const totalRelevance = sql<number>`
      (${orgSim} * 0.7) +
      (${newsScore} * 0.15) +
      (${eventsScore} * 0.15) +
      (CASE WHEN ${orgsInTest.name} ILIKE ${"%" + search + "%"} THEN 0.8 ELSE 0 END) +
      (CASE WHEN ${orgSim} > 0.85 THEN 0.4 ELSE 0 END)
    `;

    const result = await db
      .select({
        name: orgsInTest.name,
        address: orgsInTest.address,
        city: orgsInTest.city,
        domain: orgsInTest.domain,
        categories: orgsInTest.categories,
        lat: orgsInTest.lat,
        lon: orgsInTest.lon,
        desc: orgsInTest.desc,
        rawOrgScore: orgSim.as("raw_org_score"),
        topNewsList: topNews.as("top_news_list"),
        topEventsList: topEvents.as("top_events_list"),
        newsScore: newsScore.as("news_score"),
        eventsScore: eventsScore.as("events_score"),
        totalRelevance: totalRelevance.as("total_relevance"),
      })
      .from(orgsInTest)
      .where(gt(totalRelevance, 0.3))
      .orderBy(desc(totalRelevance))
      .limit(50);

    return new Response(JSON.stringify({ message: "Success", data: result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.log(err);
    return new Response(
      JSON.stringify({ message: "Database error", error: err }),
      { status: 500 },
    );
  }
};
