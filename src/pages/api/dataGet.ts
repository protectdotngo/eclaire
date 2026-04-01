import type { APIRoute } from "astro";
import { pool } from "../../lib/db";

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();
  const search = data.get("search");

  if (search && typeof search === "string") {
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
    try {
      const query = `WITH search_vector AS (
        SELECT $1::vector AS query_vec
      ),
      ranked_results AS (
        SELECT 
          o.name, o.address, o.domain, o.category, o.lat, o.lon, o.desc,
          (1 - (o.embedding <=> sv.query_vec)) AS raw_org_score,
          (SELECT jsonb_agg(jsonb_build_object('title', n.title, 'url', n.url, 'content', n.content))
          FROM (
            SELECT title, url, content, embedding
            FROM test.news
            WHERE org_id = o.id
            ORDER BY embedding <=> (SELECT query_vec FROM search_vector)
            LIMIT 5
          ) n) AS top_news_list,
          (SELECT jsonb_agg(jsonb_build_object('title', e.title, 'url', e.url, 'content', e.content))
          FROM (
            SELECT title, url, content, embedding
            FROM test.events
            WHERE org_id = o.id
            ORDER BY embedding <=> (SELECT query_vec FROM search_vector)
            LIMIT 5
          ) e) AS top_events_list,  
          COALESCE((SELECT 1 - (MIN(n.embedding <=> sv.query_vec)) FROM test.news n WHERE n.org_id = o.id), 0) AS news_score,
          COALESCE((SELECT 1 - (MIN(e.embedding <=> sv.query_vec)) FROM test.events e WHERE e.org_id = o.id), 0) AS events_score,
          ((1 - (o.embedding <=> sv.query_vec)) * 0.7) +
          (COALESCE((SELECT 1 - (MIN(n.embedding <=> sv.query_vec)) FROM test.news n WHERE n.org_id = o.id), 0) * 0.15) +
          (COALESCE((SELECT 1 - (MIN(e.embedding <=> sv.query_vec)) FROM test.events e WHERE e.org_id = o.id), 0) * 0.15) +
          (CASE  WHEN o.name ILIKE '%'|| $2 || '%' THEN 0.8 ELSE 0 END) +
          (CASE WHEN (1 - (o.embedding <=> sv.query_vec)) > 0.85 THEN 0.4 ELSE 0 END)
          AS total_relevance
        FROM test.orgs o
        CROSS JOIN search_vector sv
      )
      SELECT * FROM ranked_results
      WHERE total_relevance > 0.1
      ORDER BY total_relevance DESC
      LIMIT 3;`;
      const result = await pool.query(query, [
        JSON.stringify(queryVector),
        search,
      ]);
      return new Response(
        JSON.stringify({ message: "Success", data: result.rows }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } catch (err) {
      console.log(err);
      return new Response(
        JSON.stringify({ message: "Database error", error: err }),
        {
          status: 500,
        },
      );
    }
  }
  return new Response(JSON.stringify({ message: "Invalid search" }), {
    status: 400,
  });
};
