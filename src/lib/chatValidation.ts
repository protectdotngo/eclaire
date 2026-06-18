export type TextBlock = { type: "text"; content: string };
export type OrgsBlock = {
  type: "orgs";
  items: { id: string; reason: string }[];
};
export type EventSearchBlock = {
  type: "event_search";
  filters: EventSearchFilters;
};

export interface EventSearchFilters {
  date_from?: string;
  date_to?: string;
  day_of_week?: number;
  time_of_day?: "morning" | "afternoon" | "evening";
  categories?: string[];
  keywords?: string[];
  city?: string;
  org_ids?: string[];
  audience?: string;
}

export type Block = TextBlock | OrgsBlock | EventSearchBlock;
export type ChatResponse = { blocks: Block[] };

const MAX_ITEMS_PER_BLOCK = 5;

const TIME_OF_DAY_VALUES = ["morning", "afternoon", "evening"] as const;
const AUDIENCE_VALUES = [
  "seniors",
  "jeunesse",
  "femmes",
  "personnes migrantes",
  "handicap",
  "emploi",
  "intergénérationnel",
  "tout public",
] as const;
const VALID_CATEGORIES = new Set([
  "inclusion & accessibilité numérique",
  "formation numérique",
  "formation générale",
  "aide & soutien numérique",
  "cybersécurité & prévention",
  "action & aide sociale",
  "aide matérielle & équipement",
  "connectivité publique",
  "associations & réseaux",
  "institutions publiques",
  "plateformes d'information",
  "lieux d'accueil",
]);

export function parseAndValidate(
  rawText: string,
  validIds: Set<string>,
): { response: ChatResponse; fabricatedIds: string[] } {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    parsed = tryRepairTruncatedJson(cleaned);
    if (!parsed) throw err;
    console.warn("Recovered from truncated LLM JSON response");
  }

  if (!parsed || !Array.isArray(parsed.blocks)) {
    throw new Error("Missing 'blocks' array");
  }

  const fabricatedIds: string[] = [];
  const out: Block[] = [];

  for (const b of parsed.blocks) {
    if (!b || typeof b.type !== "string") continue;

    if (b.type === "text") {
      if (typeof b.content === "string" && b.content.trim()) {
        out.push({ type: "text", content: b.content });
      }
    } else if (b.type === "orgs") {
      if (!Array.isArray(b.items)) continue;
      const items: { id: string; reason: string }[] = [];
      for (const item of b.items) {
        if (
          !item ||
          typeof item.id !== "string" ||
          typeof item.reason !== "string"
        )
          continue;
        if (!validIds.has(item.id)) {
          fabricatedIds.push(item.id);
          continue;
        }
        items.push({ id: item.id, reason: item.reason });
        if (items.length >= MAX_ITEMS_PER_BLOCK) break;
      }
      if (items.length > 0) {
        out.push({ type: "orgs", items });
      }
    } else if (b.type === "event_search") {
      if (!b.filters || typeof b.filters !== "object") continue;
      const filters = sanitizeEventSearchFilters(
        b.filters,
        validIds,
        fabricatedIds,
      );
      out.push({ type: "event_search", filters });
    }
  }

  return { response: { blocks: out }, fabricatedIds };
}

function sanitizeEventSearchFilters(
  raw: any,
  validIds: Set<string>,
  fabricatedIds: string[],
): EventSearchFilters {
  const filters: EventSearchFilters = {};

  if (
    typeof raw.date_from === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.date_from)
  ) {
    filters.date_from = raw.date_from;
  }
  if (
    typeof raw.date_to === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.date_to)
  ) {
    filters.date_to = raw.date_to;
  }
  if (
    typeof raw.day_of_week === "number" &&
    Number.isInteger(raw.day_of_week) &&
    raw.day_of_week >= 0 &&
    raw.day_of_week <= 6
  ) {
    filters.day_of_week = raw.day_of_week;
  }
  if (
    typeof raw.time_of_day === "string" &&
    (TIME_OF_DAY_VALUES as readonly string[]).includes(raw.time_of_day)
  ) {
    filters.time_of_day = raw.time_of_day as
      | "morning"
      | "afternoon"
      | "evening";
  }
  if (Array.isArray(raw.categories)) {
    const cats = raw.categories
      .filter((c: unknown): c is string => typeof c === "string")
      .filter((c: string) => VALID_CATEGORIES.has(c));
    if (cats.length > 0) filters.categories = cats;
  }
  if (Array.isArray(raw.keywords)) {
    const kws = raw.keywords
      .filter(
        (k: unknown): k is string =>
          typeof k === "string" && k.trim().length > 0,
      )
      .slice(0, 10);
    if (kws.length > 0) filters.keywords = kws;
  }
  if (typeof raw.city === "string" && raw.city.trim().length > 0) {
    filters.city = raw.city.trim();
  }
  if (Array.isArray(raw.org_ids)) {
    const ids: string[] = [];
    for (const id of raw.org_ids) {
      if (typeof id !== "string") continue;
      if (!validIds.has(id)) {
        fabricatedIds.push(id);
        continue;
      }
      ids.push(id);
    }
    if (ids.length > 0) filters.org_ids = ids;
  }
  if (
    typeof raw.audience === "string" &&
    (AUDIENCE_VALUES as readonly string[]).includes(raw.audience)
  ) {
    filters.audience = raw.audience;
  }

  return filters;
}

export function ensureLeadingText(response: ChatResponse): ChatResponse {
  if (response.blocks.length === 0) {
    return {
      blocks: [
        {
          type: "text",
          content: "Je n'ai pas trouvé de réponse, peux-tu reformuler ?",
        },
      ],
    };
  }
  if (response.blocks[0].type !== "text") {
    return {
      blocks: [
        { type: "text", content: "Voici ce que j'ai trouvé :" },
        ...response.blocks,
      ],
    };
  }
  return response;
}

function tryRepairTruncatedJson(text: string): any | null {
  const blocksMatch = text.match(/"blocks"\s*:\s*\[/);
  if (!blocksMatch) return null;
  const arrayStart = blocksMatch.index! + blocksMatch[0].length;
  let depth = 0;
  let inString = false;
  let escape = false;
  let lastTopLevelItemEnd = -1;
  for (let i = arrayStart; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) lastTopLevelItemEnd = i;
    }
  }
  if (lastTopLevelItemEnd === -1) return null;
  const repaired = text.slice(0, lastTopLevelItemEnd + 1) + "]}";
  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}
