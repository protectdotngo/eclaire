import "dotenv/config";
import type { APIRoute } from "astro";
import { db } from "../../lib/dbDrizzle";
import { orgsInTest } from "../../../drizzle/schema";

export const GET: APIRoute = async () => {
  try {
    const result = await db.select().from(orgsInTest);
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
