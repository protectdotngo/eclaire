import type { APIRoute } from "astro";
import { pool } from "../../lib/db";

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();
  const cat = data.get("category");
  const loc = data.get("location");
  console.log(typeof loc, loc);
  const values = [];
  var query =
    "SELECT o.name, o.desc, o.domain, o.address, o.socials, o.category, o.lat, o.lon FROM test.orgs o ";

  if (cat && loc && typeof cat === "string" && typeof loc === "string") {
    console.log("Cat & Loc");
    query =
      query + "WHERE $1 = ANY(category) AND o.address ILIKE '%'|| $2 || '%';";
    values.push(cat, loc);
  } else if (cat && typeof cat === "string") {
    console.log("Cat");
    query = query + "WHERE $1 = ANY(category);";
    values.push(cat);
  } else if (loc && typeof loc === "string") {
    console.log("Loc");
    query = query + "WHERE o.address ILIKE '%'|| $1 || '%';";
    values.push(loc);
  } else {
    return new Response(JSON.stringify({ message: "Invalid search" }), {
      status: 400,
    });
  }
  try {
    const result = await pool.query(query, values);
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
};
