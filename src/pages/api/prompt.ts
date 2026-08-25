import "dotenv/config";
import type { APIRoute } from "astro";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../lib/dbDrizzle";
import { promptConfigInTest } from "../../../drizzle/schema";
import {
  PLACEHOLDER,
  getEditableTemplate,
  loadDefaultTemplate,
  invalidateCache,
} from "../../lib/chatPrompt";
import type { PromptVersion } from "../../interfaces/chat";

export const GET: APIRoute = async ({ url }) => {
  // ?id=<uuid> → content of a specific version in the history
  const id = url.searchParams.get("id");
  if (id) {
    const rows = await db
      .select()
      .from(promptConfigInTest)
      .where(eq(promptConfigInTest.id, id))
      .limit(1);
    if (!rows[0]) return json({ error: "Version introuvable" }, 404);
    const { content, createdAt } = rows[0];
    return json({ content, createdAt });
  }

  const current = await getEditableTemplate();
  let versions: PromptVersion[] = [];
  try {
    versions = await db
      .select({
        id: promptConfigInTest.id,
        createdAt: promptConfigInTest.createdAt,
        length: sql<number>`length(${promptConfigInTest.content})`,
      })
      .from(promptConfigInTest)
      .orderBy(desc(promptConfigInTest.createdAt))
      .limit(50);
  } catch {
    // Table not found → no history; the default prompt remains available
  }
  return json({ ...current, versions });
};

export const POST: APIRoute = async ({ request }) => {
  let body: { content?: unknown; reset?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON invalide" }, 400);
  }

  let content: string;
  if (body.reset === true) {
    content = await loadDefaultTemplate();
  } else {
    if (typeof body.content !== "string" || body.content.trim().length < 100) {
      return json({ error: "Contenu manquant ou trop court" }, 400);
    }
    if (!body.content.includes(PLACEHOLDER)) {
      return json(
        {
          error: `Le prompt doit contenir le placeholder de l'annuaire : ${PLACEHOLDER}`,
        },
        400,
      );
    }
    content = body.content;
  }

  try {
    await db.insert(promptConfigInTest).values({ content });
  } catch (err) {
    console.error("Failed to save prompt:", err);
    // 42P01 = undefined_table: the migration has not yet been performed
    if ((err as { cause?: { code?: string } })?.cause?.code === "42P01") {
      return json(
        {
          error:
            "The test.prompt_config table is missing — run the drizzle/0001_prompt_config.sql migration (admin privileges required)",
        },
        500,
      );
    }
    return json({ error: "Échec de la sauvegarde" }, 500);
  }

  invalidateCache();
  return json({ ok: true, source: body.reset === true ? "default" : "db" });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
