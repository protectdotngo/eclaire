import type { APIRoute } from "astro";
import { db } from "../../lib/dbDrizzle";
import { orgsInTest } from "../../../drizzle/schema";
import { sql, ilike, and, type SQL } from "drizzle-orm";

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();
  const cat = data.get("category");
  const loc = data.get("location");

  const hasCat = typeof cat === "string" && cat.length > 0;
  const hasLoc = typeof loc === "string" && loc.length > 0;

  if (!hasCat && !hasLoc) {
    return new Response(JSON.stringify({ message: "Invalid search" }), {
      status: 400,
    });
  }

  const conditions: SQL[] = [];
  if (hasCat) conditions.push(sql`${cat} = ANY(${orgsInTest.categories})`);
  if (hasLoc) conditions.push(ilike(orgsInTest.city, `%${loc}%`));

  try {
    const result = await db
      .select({
        name: orgsInTest.name,
        desc: orgsInTest.desc,
        domain: orgsInTest.domain,
        address: orgsInTest.address,
        socials: orgsInTest.socials,
        categories: orgsInTest.categories,
        lat: orgsInTest.lat,
        lon: orgsInTest.lon,
      })
      .from(orgsInTest)
      .where(and(...conditions));

    return new Response(
      JSON.stringify({ message: "Success", data: result }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.log(err);
    return new Response(
      JSON.stringify({ message: "Database error", error: err }),
      { status: 500 },
    );
  }
};