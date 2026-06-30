import fs from "node:fs/promises";
import path from "node:path";
import { db } from "./dbDrizzle";
import { orgsInTest } from "../../drizzle/schema";

let cachedTemplate: string | null = null;
let cachedOrgsJson: string | null = null;
let cachedIds: Set<string> | null = null;
let cachedAt = 0;
const TTL = 5 * 60 * 1000;

const PLACEHOLDER = "[Insère ici le contenu de l'annuaire en JSON]";

async function loadTemplate(): Promise<string> {
  if (cachedTemplate) return cachedTemplate;
  const p = path.resolve(process.cwd(), "src/lib/prompts/chatSystemPrompt.md");
  cachedTemplate = await fs.readFile(p, "utf-8");
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
      domain: r.domain,
      address: r.address,
      city: r.city,
    };
  });

  cachedOrgsJson = JSON.stringify({ orgs: orgsForLLM });
  cachedIds = ids;
  cachedAt = Date.now();
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
  cachedOrgsJson = null;
  cachedIds = null;
  cachedAt = 0;
}
