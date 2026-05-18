import "dotenv/config";
import type { APIRoute } from "astro";
import { db } from "../../lib/dbDrizzle";
import { orgsInTest } from "../../../drizzle/schema";

export const GET: APIRoute = async () => {
  try {
    const result = await db
      .select({
        id: orgsInTest.id,
        name: orgsInTest.name,
        address: orgsInTest.address,
        city: orgsInTest.city,
        domain: orgsInTest.domain,
        category: orgsInTest.category,
        lat: orgsInTest.lat,
        lon: orgsInTest.lon,
        desc: orgsInTest.desc,
      })
      .from(orgsInTest);
    return new Response(
      JSON.stringify({ message: "Success", data: result }),
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
