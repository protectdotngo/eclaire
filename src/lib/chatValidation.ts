import type {
  Block,
  ChatResponse,
  EventSearchFilters,
  ReplyLang,
  ScopeTrip,
} from "../interfaces/chat";
import { AUDIENCE_TAGS } from "../data/audienceTags";

const MAX_ITEMS_PER_BLOCK = 5;

/**
 * Sortie A (clarification / help) and Sortie D (out-of-scope redirect) are by
 * spec a single SHORT text block. The longest legitimate example in the system
 * prompt is the RÈGLE 4 orientation message at ~443 chars, ~575 once
 * translated into German. A text-only answer above this cap is structurally
 * out of spec — the model is writing prose (a recipe, an essay) instead of
 * planning a query — so we discard it wholesale.
 *
 * The same figure is stated in the system prompt (Sortie A/D and the final
 * self-check) so that both layers agree on the bound.
 */
export const MAX_TEXT_ONLY_CHARS = 900;

const REPLY_LANGS: readonly ReplyLang[] = ["fr", "en", "de", "it", "es"];

/**
 * Canned out-of-scope redirect, one per supported language. Written here and
 * never by the model: the whole point of the guard is that no model prose
 * survives a scope trip.
 */
const SCOPE_REDIRECT: Record<ReplyLang, string> = {
  fr: "Je peux seulement t'aider sur des questions liées au numérique et aux technologies : apprendre à utiliser un ordinateur ou un smartphone, trouver une formation ou de l'aide informatique, cybersécurité, arnaques en ligne, équipement et connexion. Pose-moi une question sur l'un de ces sujets et je cherche dans l'annuaire genevois.",
  en: "I can only help with digital and technology questions: learning to use a computer or a smartphone, finding training or IT support, cybersecurity, online scams, equipment and connectivity. Ask me about one of those topics and I'll search the Geneva directory.",
  de: "Ich kann dir nur bei Fragen zu Digitalem und Technik helfen: den Umgang mit Computer oder Smartphone lernen, Kurse oder IT-Unterstützung finden, Cybersicherheit, Online-Betrug, Geräte und Internetzugang. Stell mir eine Frage dazu, dann suche ich im Genfer Verzeichnis.",
  it: "Posso aiutarti solo con domande sul digitale e sulle tecnologie: imparare a usare un computer o uno smartphone, trovare una formazione o assistenza informatica, cybersicurezza, truffe online, attrezzature e connessione. Fammi una domanda su questi temi e cerco nell'annuario ginevrino.",
  es: "Solo puedo ayudarte con preguntas sobre lo digital y las tecnologías: aprender a usar un ordenador o un móvil, encontrar formación o ayuda informática, ciberseguridad, estafas en línea, equipamiento y conexión. Pregúntame sobre estos temas y busco en el directorio ginebrino.",
};

const TIME_OF_DAY_VALUES = ["morning", "afternoon", "evening"] as const;
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
): {
  response: ChatResponse;
  fabricatedIds: string[];
  offTopic: boolean;
  asksAsOrg: boolean;
  lang: ReplyLang;
} {
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

  // Root-level fields the model declares alongside `blocks`. `lang` is
  // whitelisted rather than trusted: only one of five keys into a
  // server-owned table can survive, so the model cannot author its own
  // redirect text.
  const offTopic = parsed.off_topic === true;
  // Same discipline for the EC-41 signal: a boolean is all the model gets to
  // decide. The card's wording and link are server-owned (see the `builders`
  // block appended in /api/chat), so no model prose reaches that card either.
  const asksAsOrg = parsed.asks_as_org === true;
  const lang: ReplyLang = REPLY_LANGS.includes(parsed.lang)
    ? (parsed.lang as ReplyLang)
    : "fr";

  return {
    response: { blocks: out },
    fabricatedIds,
    offTopic,
    asksAsOrg,
    lang,
  };
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
  // Only a literal `true` survives: an absent key and `false` mean the same
  // thing (apply the not-past floor), so the flag is dropped rather than
  // stored as false.
  if (raw.include_past === true) {
    filters.include_past = true;
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
    (AUDIENCE_TAGS as readonly string[]).includes(raw.audience)
  ) {
    filters.audience = raw.audience;
  }
  if (
    typeof raw.offset === "number" &&
    Number.isInteger(raw.offset) &&
    raw.offset >= 0
  ) {
    filters.offset = raw.offset;
  }

  return filters;
}

/**
 * Deterministic scope enforcement — the layer that does not depend on the
 * model behaving. Two independent triggers:
 *
 *  - `model_signal`: the model set `"off_topic": true`. This is the reliable
 *    path, and the only one that catches SHORT off-topic answers that no
 *    length heuristic can see (a two-line cocktail list is ~120 chars).
 *  - `text_too_long`: a text-only answer above MAX_TEXT_ONLY_CHARS. Backstop
 *    for a model that ignores the scope rule entirely and writes a recipe or
 *    an essay without flagging it.
 *
 * On a trip the model's blocks are dropped wholesale and replaced with the
 * canned redirect, so nothing the model wrote reaches the user.
 */
export function enforceScope(
  response: ChatResponse,
  opts: { offTopic: boolean; lang: ReplyLang },
): { response: ChatResponse; tripped: ScopeTrip | null } {
  const textOnly =
    response.blocks.length > 0 &&
    response.blocks.every((b) => b.type === "text");
  const textLength = response.blocks.reduce(
    (n, b) => (b.type === "text" ? n + b.content.length : n),
    0,
  );

  let tripped: ScopeTrip | null = null;
  if (opts.offTopic) tripped = "model_signal";
  else if (textOnly && textLength > MAX_TEXT_ONLY_CHARS)
    tripped = "text_too_long";

  if (!tripped) return { response, tripped: null };

  return {
    response: {
      blocks: [{ type: "text", content: SCOPE_REDIRECT[opts.lang] }],
    },
    tripped,
  };
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
