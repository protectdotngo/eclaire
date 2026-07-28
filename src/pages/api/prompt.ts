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

export const GET: APIRoute = async ({ url }) => {
  // ?id=<uuid> → contenu d'une version précise de l'historique
  const id = url.searchParams.get("id");
  if (id) {
    const rows = await db
      .select()
      .from(promptConfigInTest)
      .where(eq(promptConfigInTest.id, id))
      .limit(1);
    if (!rows[0]) return json({ error: "Version introuvable" }, 404);
    return json({ content: rows[0].content, createdAt: rows[0].createdAt });
  }

  const current = await getEditableTemplate();
  let versions: Array<{ id: string; createdAt: string; length: number }> = [];
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
    // table absente → pas d'historique, le prompt par défaut reste utilisable
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
    // 42P01 = undefined_table : la migration n'a pas encore été exécutée
    if ((err as { cause?: { code?: string } })?.cause?.code === "42P01") {
      return json(
        {
          error:
            "Table test.prompt_config manquante — exécuter la migration drizzle/0001_prompt_config.sql (droits admin requis)",
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
