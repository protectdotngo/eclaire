import type { APIRoute } from "astro";
import { pool } from "../../lib/db";

export const GET: APIRoute = async () => {
  try {
    const result = await pool.query("SELECT o.name, o.desc, o.domain, o.address, o.socials, o.category, o.lat, o.lon FROM test.orgs o;");
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
