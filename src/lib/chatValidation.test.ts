import { describe, expect, it } from "vitest";
import {
  MAX_TEXT_ONLY_CHARS,
  enforceScope,
  ensureLeadingText,
  parseAndValidate,
} from "./chatValidation";
import type {
  ChatResponse,
  EventSearchBlock,
  EventSearchFilters,
  ReplyLang,
} from "../interfaces/chat";

const VALID_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_ID = "22222222-2222-2222-2222-222222222222";
const validIds = new Set([VALID_ID, OTHER_ID]);

/**
 * The real RÈGLE 4 orientation message from chatSystemPrompt.md (433 chars).
 * This is the longest legitimate text-only response the assistant produces,
 * so it is the load-bearing false-positive fixture for the length cap.
 */
const HELP_MESSAGE = `Bonjour ! Je suis là pour t'aider à trouver des organisations ou des événements liés au numérique à Genève. Tu peux me poser des questions sur :

- **Quand** (ex. "ateliers cette semaine", "événements ce mardi soir")
- **Où** (ex. "à Carouge", "près des Pâquis")
- **Quelle organisation** (ex. "que propose Pro Senectute")
- **Quel sujet** (ex. "cours Excel", "sensibilisation au phishing")

Qu'est-ce qui t'intéresse ?`;

const text = (content: string): ChatResponse => ({
  blocks: [{ type: "text", content }],
});
const onTopic = { offTopic: false, lang: "fr" as ReplyLang };

describe("enforceScope", () => {
  it("pins the cap so a regression cannot silently widen it", () => {
    // The tests below express lengths relative to the constant, so without
    // this absolute assertion raising the cap would keep the suite green.
    expect(MAX_TEXT_ONLY_CHARS).toBe(900);
  });

  it("replaces a realistic unflagged recipe on length alone", () => {
    // An absolute-length fixture: the exploit from EC-38 as the model would
    // actually write it, independent of the constant's value.
    const step =
      "Fais fondre 200 g de chocolat noir avec 150 g de beurre au bain-marie, " +
      "ajoute 150 g de sucre, 4 œufs puis 50 g de farine, et enfourne 25 min. ";
    const recipe = text(
      "Voici une recette de gâteau au chocolat pour 8 personnes. " +
        step.repeat(8),
    );
    const content = (recipe.blocks[0] as { content: string }).content;
    expect(content.length).toBeGreaterThan(1000);

    expect(enforceScope(recipe, onTopic).tripped).toBe("text_too_long");
  });

  it("replaces the answer when the model signals off_topic", () => {
    const recipe = text("Pour un gâteau au chocolat : 200g de chocolat…");
    const { response, tripped } = enforceScope(recipe, {
      offTopic: true,
      lang: "fr",
    });

    expect(tripped).toBe("model_signal");
    expect(response.blocks).toHaveLength(1);
    expect(response.blocks[0]).toMatchObject({ type: "text" });
    // Nothing the model wrote survives.
    expect(JSON.stringify(response)).not.toContain("chocolat");
    expect(JSON.stringify(response)).toContain("numérique");
  });

  it("catches a short off-topic answer that no length heuristic could see", () => {
    // The cocktail exploit: ~120 chars, far under the cap. Only the model
    // signal can catch this, which is why the signal is the primary guard.
    const cocktails = text(
      "Un mojito : rhum blanc, menthe, citron vert, sucre de canne. Un spritz : Aperol, prosecco, eau pétillante.",
    );
    expect(cocktails.blocks[0]).toMatchObject({ type: "text" });
    expect(
      (cocktails.blocks[0] as { content: string }).content.length,
    ).toBeLessThan(MAX_TEXT_ONLY_CHARS);

    const { tripped } = enforceScope(cocktails, { offTopic: true, lang: "fr" });
    expect(tripped).toBe("model_signal");
  });

  it("replaces an unflagged text-only answer over the cap", () => {
    const essay = text("a".repeat(MAX_TEXT_ONLY_CHARS + 1));
    const { response, tripped } = enforceScope(essay, onTopic);

    expect(tripped).toBe("text_too_long");
    expect(response.blocks).toHaveLength(1);
    expect(JSON.stringify(response)).not.toContain("aaaa");
  });

  it("sums text across multiple blocks when applying the cap", () => {
    const half = "b".repeat(Math.ceil((MAX_TEXT_ONLY_CHARS + 2) / 2));
    const { tripped } = enforceScope(
      {
        blocks: [
          { type: "text", content: half },
          { type: "text", content: half },
        ],
      },
      onTopic,
    );
    expect(tripped).toBe("text_too_long");
  });

  it("leaves the real RÈGLE 4 help message untouched", () => {
    // The critical false-positive assertion: over-refusal is the failure mode
    // that damages the product.
    expect(HELP_MESSAGE.length).toBeLessThan(MAX_TEXT_ONLY_CHARS);

    const help = text(HELP_MESSAGE);
    const { response, tripped } = enforceScope(help, onTopic);

    expect(tripped).toBeNull();
    expect(response).toBe(help);
  });

  it("leaves a text block at exactly the cap untouched", () => {
    const { tripped } = enforceScope(
      text("c".repeat(MAX_TEXT_ONLY_CHARS)),
      onTopic,
    );
    expect(tripped).toBeNull();
  });

  it("does not apply the cap when the response carries an orgs block", () => {
    // A long intro plus real search results is not a text-only answer, so the
    // structural cap must not fire on it.
    const withOrgs: ChatResponse = {
      blocks: [
        { type: "text", content: "d".repeat(MAX_TEXT_ONLY_CHARS + 500) },
        { type: "orgs", items: [{ id: VALID_ID, reason: "…" }] },
      ],
    };
    const { response, tripped } = enforceScope(withOrgs, onTopic);

    expect(tripped).toBeNull();
    expect(response).toBe(withOrgs);
  });

  it("does not apply the cap when the response carries an event_search block", () => {
    const withSearch: ChatResponse = {
      blocks: [
        { type: "text", content: "e".repeat(MAX_TEXT_ONLY_CHARS + 500) },
        { type: "event_search", filters: { city: "Carouge" } },
      ],
    };
    expect(enforceScope(withSearch, onTopic).tripped).toBeNull();
  });

  it("leaves an empty response untouched so ensureLeadingText can handle it", () => {
    const empty: ChatResponse = { blocks: [] };
    const { response, tripped } = enforceScope(empty, onTopic);

    expect(tripped).toBeNull();
    expect(response).toBe(empty);
  });

  it("returns a distinct redirect for each supported language", () => {
    const langs: ReplyLang[] = ["fr", "en", "de", "it", "es"];
    const seen = langs.map((lang) => {
      const { response } = enforceScope(text("…"), { offTopic: true, lang });
      const block = response.blocks[0];
      expect(block.type).toBe("text");
      return (block as { content: string }).content;
    });

    expect(new Set(seen).size).toBe(langs.length);
    for (const content of seen) expect(content.length).toBeGreaterThan(50);
    expect(seen[1]).toContain("digital and technology");
    expect(seen[2]).toContain("Digitalem");
  });
});

describe("parseAndValidate — scope root fields", () => {
  const parse = (obj: unknown) =>
    parseAndValidate(JSON.stringify(obj), validIds);

  it("reads off_topic and lang from the root", () => {
    const r = parse({
      off_topic: true,
      lang: "en",
      blocks: [{ type: "text", content: "…" }],
    });
    expect(r.offTopic).toBe(true);
    expect(r.lang).toBe("en");
  });

  it("defaults off_topic to false when absent", () => {
    expect(parse({ blocks: [{ type: "text", content: "…" }] }).offTopic).toBe(
      false,
    );
  });

  it("treats a truthy non-boolean off_topic as false", () => {
    // Strict === true, so the model cannot half-signal its way through.
    expect(
      parse({ off_topic: "yes", blocks: [{ type: "text", content: "…" }] })
        .offTopic,
    ).toBe(false);
  });

  it("falls back to fr for a missing or unsupported lang", () => {
    const blocks = [{ type: "text", content: "…" }];
    expect(parse({ blocks }).lang).toBe("fr");
    expect(parse({ lang: "pt", blocks }).lang).toBe("fr");
    expect(parse({ lang: 42, blocks }).lang).toBe("fr");
  });
});

describe("parseAndValidate — existing guarantees", () => {
  it("strips a json code fence", () => {
    const r = parseAndValidate(
      '```json\n{"blocks":[{"type":"text","content":"ok"}]}\n```',
      validIds,
    );
    expect(r.response.blocks).toEqual([{ type: "text", content: "ok" }]);
  });

  it("drops fabricated org ids and reports them", () => {
    const r = parseAndValidate(
      JSON.stringify({
        blocks: [
          {
            type: "orgs",
            items: [
              { id: VALID_ID, reason: "real" },
              { id: "not-a-real-id", reason: "invented" },
            ],
          },
        ],
      }),
      validIds,
    );
    expect(r.fabricatedIds).toEqual(["not-a-real-id"]);
    expect(r.response.blocks).toEqual([
      { type: "orgs", items: [{ id: VALID_ID, reason: "real" }] },
    ]);
  });

  it("caps an orgs block at 5 items", () => {
    const many = new Set(Array.from({ length: 8 }, (_, i) => `id-${i}`));
    const r = parseAndValidate(
      JSON.stringify({
        blocks: [
          {
            type: "orgs",
            items: Array.from({ length: 8 }, (_, i) => ({
              id: `id-${i}`,
              reason: "…",
            })),
          },
        ],
      }),
      many,
    );
    const block = r.response.blocks[0] as { items: unknown[] };
    expect(block.items).toHaveLength(5);
  });

  it("recovers a truncated response by dropping the incomplete block", () => {
    const truncated =
      '{"blocks":[{"type":"text","content":"début"},{"type":"orgs","items":[{"id":"';
    const r = parseAndValidate(truncated, validIds);
    expect(r.response.blocks).toEqual([{ type: "text", content: "début" }]);
  });

  it("throws when there is no blocks array", () => {
    expect(() => parseAndValidate('{"foo":1}', validIds)).toThrow();
  });

  it("skips empty and whitespace-only text blocks", () => {
    const r = parseAndValidate(
      JSON.stringify({
        blocks: [
          { type: "text", content: "   " },
          { type: "text", content: "kept" },
        ],
      }),
      validIds,
    );
    expect(r.response.blocks).toEqual([{ type: "text", content: "kept" }]);
  });
});

describe("event_search filter sanitisation", () => {
  const filtersFor = (raw: Record<string, unknown>): EventSearchFilters => {
    const r = parseAndValidate(
      JSON.stringify({ blocks: [{ type: "event_search", filters: raw }] }),
      validIds,
    );
    return (r.response.blocks[0] as EventSearchBlock).filters;
  };

  it("keeps well-formed ISO dates and drops malformed ones", () => {
    expect(
      filtersFor({ date_from: "2026-09-09", date_to: "next week" }),
    ).toEqual({ date_from: "2026-09-09" });
  });

  it("bounds day_of_week to 0-6 and rejects non-integers", () => {
    expect(filtersFor({ day_of_week: 6 })).toEqual({ day_of_week: 6 });
    expect(filtersFor({ day_of_week: 7 })).toEqual({});
    expect(filtersFor({ day_of_week: 2.5 })).toEqual({});
  });

  it("whitelists time_of_day", () => {
    expect(filtersFor({ time_of_day: "evening" })).toEqual({
      time_of_day: "evening",
    });
    expect(filtersFor({ time_of_day: "night" })).toEqual({});
  });

  it("keeps only categories from the taxonomy", () => {
    expect(
      filtersFor({
        categories: [
          "cybersécurité & prévention",
          "patisserie",
          "cybersecurite",
        ],
      }),
    ).toEqual({ categories: ["cybersécurité & prévention"] });
  });

  it("drops the categories key entirely when none survive", () => {
    expect(filtersFor({ categories: ["gâteaux"] })).toEqual({});
  });

  it("whitelists audience against AUDIENCE_TAGS", () => {
    expect(filtersFor({ audience: "seniors" })).toEqual({
      audience: "seniors",
    });
    expect(filtersFor({ audience: "pâtissiers" })).toEqual({});
  });

  it("caps keywords at 10 and drops blanks", () => {
    const kws = filtersFor({
      keywords: [...Array.from({ length: 12 }, (_, i) => `k${i}`), "  "],
    });
    expect(kws.keywords).toHaveLength(10);
  });

  it("filters fabricated org_ids", () => {
    const r = parseAndValidate(
      JSON.stringify({
        blocks: [
          { type: "event_search", filters: { org_ids: [VALID_ID, "made-up"] } },
        ],
      }),
      validIds,
    );
    expect(r.fabricatedIds).toEqual(["made-up"]);
    expect((r.response.blocks[0] as EventSearchBlock).filters.org_ids).toEqual([
      VALID_ID,
    ]);
  });

  it("requires offset to be a non-negative integer", () => {
    expect(filtersFor({ offset: 10 })).toEqual({ offset: 10 });
    expect(filtersFor({ offset: -1 })).toEqual({});
    expect(filtersFor({ offset: "10" })).toEqual({});
  });
});

describe("ensureLeadingText", () => {
  it("substitutes a message for an empty response", () => {
    expect(ensureLeadingText({ blocks: [] }).blocks).toHaveLength(1);
  });

  it("prepends an intro when the first block is not text", () => {
    const r = ensureLeadingText({
      blocks: [{ type: "orgs", items: [{ id: VALID_ID, reason: "…" }] }],
    });
    expect(r.blocks[0]).toMatchObject({ type: "text" });
    expect(r.blocks).toHaveLength(2);
  });

  it("leaves a text-led response alone", () => {
    const r = text("déjà du texte");
    expect(ensureLeadingText(r)).toBe(r);
  });
});
