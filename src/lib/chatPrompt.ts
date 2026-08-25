import fs from "node:fs/promises";
import path from "node:path";
import { desc } from "drizzle-orm";
import { db } from "./dbDrizzle";
import { orgsInTest, promptConfigInTest } from "../../drizzle/schema";
import type { OrgLite } from "../interfaces";

let cachedTemplate: string | null = null;
let cachedTemplateAt = 0;
let cachedOrgsJson: string | null = null;
let cachedOrgs: OrgLite[] | null = null;
let cachedIds: Set<string> | null = null;
let cachedAt = 0;
const TTL = 5 * 60 * 1000;

export const PLACEHOLDER = "[Insère ici le contenu de l'annuaire en JSON]";

export async function loadDefaultTemplate(): Promise<string> {
  const p = path.resolve(process.cwd(), "src/lib/prompts/chatSystemPrompt.md");
  return fs.readFile(p, "utf-8");
}

// The template stored in DB (edited via /prompt) wins; the bundled .md file
// is the versioned default. DB errors (table not created yet, etc.) fall back
// to the default so chat keeps working.
export async function getEditableTemplate(): Promise<{
  content: string;
  source: "db" | "default";
  updatedAt: string | null;
}> {
  try {
    const rows = await db
      .select()
      .from(promptConfigInTest)
      .orderBy(desc(promptConfigInTest.createdAt))
      .limit(1);
    if (rows[0]) {
      return {
        content: rows[0].content,
        source: "db",
        updatedAt: rows[0].createdAt,
      };
    }
  } catch (err) {
    console.error("prompt_config read failed, using default template:", err);
  }
  return {
    content: await loadDefaultTemplate(),
    source: "default",
    updatedAt: null,
  };
}

async function loadTemplate(): Promise<string> {
  if (cachedTemplate && Date.now() - cachedTemplateAt < TTL) {
    return cachedTemplate;
  }
  cachedTemplate = (await getEditableTemplate()).content;
  cachedTemplateAt = Date.now();
  return cachedTemplate;
}

async function refreshOrgsCache(): Promise<void> {
  const rows = await db
    .select({
      id: orgsInTest.id,
      name: orgsInTest.name,
      desc: orgsInTest.desc,
      categories: orgsInTest.categories,
      domain: orgsInTest.domain,
      rss: orgsInTest.rss,
      eventsUrl: orgsInTest.eventsUrl,
      newsUrl: orgsInTest.newsUrl,
      socials: orgsInTest.socials,
      contact: orgsInTest.contact,
      address: orgsInTest.address,
      city: orgsInTest.city,
      lat: orgsInTest.lat,
      lon: orgsInTest.lon,
    })
    .from(orgsInTest);

  const ids = new Set<string>();
  const orgsForLLM = rows.map((r) => {
    ids.add(r.id);
    return {
      id: r.id,
      name: r.name,
      desc: r.desc,
      categories: r.categories,
      address: r.address,
      city: r.city,
    };
  });

  cachedOrgsJson = JSON.stringify({ orgs: orgsForLLM });
  cachedOrgs = orgsForLLM;
  cachedIds = ids;
  cachedAt = Date.now();
}

export async function getOrgsForMatching(): Promise<OrgLite[]> {
  await ensureCache();
  return cachedOrgs!;
}

async function ensureCache(): Promise<void> {
  if (!cachedOrgsJson || Date.now() - cachedAt > TTL) {
    await refreshOrgsCache();
  }
}

export async function buildSystemPrompt(): Promise<string> {
  const template = await loadTemplate();
  await ensureCache();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dayOfWeek = today.toLocaleDateString("fr-FR", { weekday: "long" });
  const formattedDate = today.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const dateHeader = `# CONTEXTE TEMPOREL\n\nAujourd'hui est le ${formattedDate} (${todayStr}, jour de la semaine: ${dayOfWeek}).\n\n`;

  return dateHeader + template.replace(PLACEHOLDER, cachedOrgsJson!);
}

export async function getValidOrgIds(): Promise<Set<string>> {
  await ensureCache();
  return new Set(cachedIds!);
}

export function invalidateCache(): void {
  cachedTemplate = null;
  cachedTemplateAt = 0;
  cachedOrgsJson = null;
  cachedOrgs = null;
  cachedIds = null;
  cachedAt = 0;
}
