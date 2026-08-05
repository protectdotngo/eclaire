import type { APIRoute } from "astro";
import { db } from "../../lib/dbDrizzle";
import { orgsInTest, propositionsInTest } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";

const REQUIRED = [
  "submitter_type",
  "action",
  "submitter_name",
  "submitter_email",
  "name",
  "desc",
  "domain",
];

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    for (const field of REQUIRED) {
      if (
        !body[field] ||
        (typeof body[field] === "string" && !body[field].trim())
      ) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    if (!Array.isArray(body.categories) || body.categories.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one category is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (body.action === "modify") {
      if (!body.modifying_org_id) {
        return new Response(
          JSON.stringify({
            error: "modifying_org_id required for modify action",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const [org] = await db
        .select({ id: orgsInTest.id })
        .from(orgsInTest)
        .where(eq(orgsInTest.id, body.modifying_org_id))
        .limit(1);

      if (!org) {
        return new Response(
          JSON.stringify({ error: "Referenced org does not exist" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const [inserted] = await db
      .insert(propositionsInTest)
      .values({
        submitterType: body.submitter_type,
        action: body.action,
        modifyingOrgId: body.modifying_org_id || null,
        submitterName: body.submitter_name,
        submitterEmail: body.submitter_email,
        name: body.name,
        desc: body.desc,
        categories: body.categories,
        domain: body.domain,
        address: body.address || null,
        city: body.city || null,
        rss: body.rss || null,
        eventsUrl: body.events_url || null,
        newsUrl: body.news_url || null,
        socials: body.socials || [],
        contact: body.contact || [],
      })
      .returning({ id: propositionsInTest.id });

    if (process.env.N8N_WEBHOOK_URL) {
      console.log("Fetching n8n");
      fetch(process.env.N8N_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Eclaire-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET!,
        },
        body: JSON.stringify({ id: inserted.id }),
      }).catch((err) => {
        console.error("Failed to notify n8n webhook:", err);
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Proposer endpoint error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
