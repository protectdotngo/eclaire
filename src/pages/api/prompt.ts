import "dotenv/config";
import type { APIRoute } from "astro";
import { db } from "../../lib/dbDrizzle";
import { promptConfigInTest } from "../../../drizzle/schema";
import {
  PLACEHOLDER,
  getEditableTemplate,
  loadDefaultTemplate,
  invalidateCache,
} from "../../lib/chatPrompt";

export const GET: APIRoute = async () => {
  const current = await getEditableTemplate();
  return json(current);
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
