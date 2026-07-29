import "dotenv/config";
import type { APIRoute } from "astro";
import {
  and,
  asc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../../lib/dbDrizzle";
import {
  eventsInTest,
  orgsInTest,
  orgsEventsInTest,
} from "../../../drizzle/schema";
import {
  buildSystemPrompt,
  getOrgsForMatching,
  getValidOrgIds,
} from "../../lib/chatPrompt";
import {
  candidatesPromptSection,
  selectCandidates,
} from "../../lib/orgCandidates";
import {
  parseAndValidate,
  ensureLeadingText,
  type EventSearchFilters,
} from "../../lib/chatValidation";
import type { Data } from "../../interfaces/dbData";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages: Message[];
}

const LLM_API_URL = process.env.SCW_API_LLM_LNK;
const LLM_API_KEY = process.env.SCW_API_KEY;
const LLM_MODEL = "qwen3-235b-a22b-instruct-2507";
const MAX_TOKENS = 2000;
const TEMPERATURE = 0.1;

export const POST: APIRoute = async ({ request }) => {
  if (!LLM_API_URL || !LLM_API_KEY) {
    console.error("Missing SCW_API_LLM_LNK or SCW_API_KEY env vars");
    return new Response(JSON.stringify({ error: "Chat is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: "Missing messages" }, 400);
  }

  let systemPrompt: string;
  let validIds: Set<string>;
  try {
    systemPrompt = await buildSystemPrompt();
    validIds = await getValidOrgIds();

    // Pré-sélection déterministe : oriente l'attention du LLM vers les orgs
    // dont le desc correspond aux mots de la question (annuaire complet
    // toujours fourni — aucune perte si le matching ne trouve rien).
    const lastUserMsg = [...body.messages]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMsg) {
      const candidates = selectCandidates(
        lastUserMsg.content,
        await getOrgsForMatching(),
      );
      systemPrompt += candidatesPromptSection(candidates);
    }
  } catch (err) {
    console.error("Failed to load directory:", err);
    return json({ error: "Directory unavailable" }, 500);
  }

  let rawText: string;
  try {
    const llmRes = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...body.messages],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        response_format: { type: "json_object" },
      }),
    });
    if (!llmRes.ok) {
      console.error("LLM error", llmRes.status, await llmRes.text());
      return json({ error: "LLM error" }, 502);
    }
    const llmData = await llmRes.json();
    rawText = llmData?.choices?.[0]?.message?.content;
    //console.log("[chat] full LLM response:", JSON.stringify(llmData, null, 2));
    if (!rawText) {
      return json({ error: "Empty LLM response" }, 502);
    }
    if (typeof rawText !== "string") {
      return json({ error: "Bad LLM response shape" }, 502);
    }
  } catch (err) {
    console.error("LLM call failed:", err);
    return json({ error: "LLM call failed" }, 502);
  }

  let parsed;
  try {
    parsed = parseAndValidate(rawText, validIds);
  } catch (err) {
    console.error("Validation failed:", err, rawText);
    return json({ error: "Bad LLM output" }, 502);
  }

  const response = ensureLeadingText(parsed.response);

  const orgBlocks = response.blocks.filter((b) => b.type === "orgs") as Array<{
    type: "orgs";
    items: Array<{ id: string; reason: string }>;
  }>;
  const allOrgIds = orgBlocks.flatMap((b) => b.items.map((i) => i.id));

  let hydratedOrgs: Data[] = [];
  if (allOrgIds.length > 0) {
    try {
      const rows = await db
        .select()
        .from(orgsInTest)
        .where(inArray(orgsInTest.id, allOrgIds));

      const reasonById = new Map<string, string>();
      for (const block of orgBlocks) {
        for (const item of block.items) {
          reasonById.set(item.id, item.reason);
        }
      }
      hydratedOrgs = allOrgIds
        .map((id) => {
          const row = rows.find((r) => r.id === id);
          if (!row) return null;
          return {
            ...row,
            reason: reasonById.get(id) ?? "",
          } as unknown as Data;
        })
        .filter((x): x is Data => x !== null);
    } catch (err) {
      console.error("Failed to hydrate orgs:", err);
    }
  }
  if (hydratedOrgs.length > 0) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const orgIdsToLookup = hydratedOrgs.map((o) => o.id);

      const upcomingRows = await db
        .select({
          orgId: orgsEventsInTest.orgId,
          eventId: eventsInTest.id,
          eventTitle: eventsInTest.title,
          eventUrl: eventsInTest.url,
          eventStartDate: eventsInTest.startDate,
        })
        .from(orgsEventsInTest)
        .innerJoin(eventsInTest, eq(eventsInTest.id, orgsEventsInTest.eventId))
        .where(
          and(
            inArray(orgsEventsInTest.orgId, orgIdsToLookup),
            or(
              gte(eventsInTest.startDate, today),
              isNull(eventsInTest.startDate),
            ),
          ),
        )
        .orderBy(asc(eventsInTest.startDate));

      const firstEventByOrg = new Map<
        string,
        { id: string; title: string; url: string | null }
      >();
      for (const row of upcomingRows) {
        if (!firstEventByOrg.has(row.orgId)) {
          firstEventByOrg.set(row.orgId, {
            id: row.eventId,
            title: row.eventTitle ?? "Sans titre",
            url: row.eventUrl,
          });
        }
      }

      for (const org of hydratedOrgs) {
        (
          org as unknown as {
            upcomingEvent: typeof firstEventByOrg extends Map<string, infer V>
              ? V | null
              : never;
          }
        ).upcomingEvent = firstEventByOrg.get(org.id) ?? null;
      }
    } catch (err) {
      console.error("Failed to fetch upcoming events:", err);
    }
  }

  const eventSearchBlock = response.blocks.find(
    (b) => b.type === "event_search",
  );
  let events: any[] = [];
  if (eventSearchBlock && eventSearchBlock.type === "event_search") {
    try {
      events = await runEventSearch(eventSearchBlock.filters);
    } catch (err) {
      console.error("Event search failed:", err);
    }
  }

  return json({
    blocks: response.blocks,
    orgs: hydratedOrgs,
    events,
    fabricatedIdsFiltered: parsed.fabricatedIds.length,
  });
};

async function runEventSearch(filters: EventSearchFilters) {
  const conditions: any[] = [];

  if (filters.date_from) {
    conditions.push(
      or(
        gte(eventsInTest.startDate, filters.date_from),
        isNull(eventsInTest.startDate),
      ),
    );
  } else {
    const today = new Date().toISOString().slice(0, 10);
    conditions.push(
      or(
        gte(eventsInTest.endDate, today),
        and(isNull(eventsInTest.endDate), gte(eventsInTest.startDate, today)),
        and(isNull(eventsInTest.endDate), isNull(eventsInTest.startDate)),
      ),
    );
  }
  if (filters.date_to) {
    conditions.push(
      or(
        lte(eventsInTest.startDate, filters.date_to),
        isNull(eventsInTest.startDate),
      ),
    );
  }

  if (filters.day_of_week !== undefined) {
    conditions.push(
      sql`EXTRACT(DOW FROM ${eventsInTest.startDate}) = ${filters.day_of_week}`,
    );
  }

  if (filters.time_of_day) {
    const hourRange = {
      morning: [5, 12],
      afternoon: [12, 18],
      evening: [18, 23],
    }[filters.time_of_day];
    conditions.push(
      sql`EXTRACT(HOUR FROM ${eventsInTest.startDate}) >= ${hourRange[0]} AND EXTRACT(HOUR FROM ${eventsInTest.startDate}) < ${hourRange[1]}`,
    );
  }

  if (filters.categories && filters.categories.length > 0) {
    conditions.push(
      sql`${eventsInTest.categories} && ${filters.categories}::text[]`,
    );
  }

  if (filters.audience) {
    conditions.push(sql`${filters.audience} = ANY(${eventsInTest.categories})`);
  }

  if (filters.keywords && filters.keywords.length > 0) {
    const keywordConditions = filters.keywords.map((kw) =>
      or(
        ilike(eventsInTest.title, `%${kw}%`),
        ilike(eventsInTest.content, `%${kw}%`),
      ),
    );
    conditions.push(or(...keywordConditions));
  }

  const needsOrgJoin =
    (filters.city && filters.city.length > 0) ||
    (filters.org_ids && filters.org_ids.length > 0);

  let eventRows: Array<{
    id: string;
    url: string | null;
    title: string | null;
    content: string | null;
    startDate: string | null;
    endDate: string | null;
    location: string | null;
    categories: string[] | null;
  }>;

  if (needsOrgJoin) {
    const orgConditions: any[] = [];
    if (filters.city) {
      orgConditions.push(ilike(orgsInTest.city, `%${filters.city}%`));
    }
    if (filters.org_ids && filters.org_ids.length > 0) {
      orgConditions.push(inArray(orgsInTest.id, filters.org_ids));
    }

    eventRows = await db
      .selectDistinct({
        id: eventsInTest.id,
        url: eventsInTest.url,
        title: eventsInTest.title,
        content: eventsInTest.content,
        startDate: eventsInTest.startDate,
        endDate: eventsInTest.endDate,
        location: eventsInTest.location,
        categories: eventsInTest.categories,
      })
      .from(eventsInTest)
      .innerJoin(
        orgsEventsInTest,
        eq(orgsEventsInTest.eventId, eventsInTest.id),
      )
      .innerJoin(orgsInTest, eq(orgsInTest.id, orgsEventsInTest.orgId))
      .where(and(...conditions, ...orgConditions))
      .limit(10);
  } else {
    eventRows = await db
      .select({
        id: eventsInTest.id,
        url: eventsInTest.url,
        title: eventsInTest.title,
        content: eventsInTest.content,
        startDate: eventsInTest.startDate,
        endDate: eventsInTest.endDate,
        location: eventsInTest.location,
        categories: eventsInTest.categories,
      })
      .from(eventsInTest)
      .where(and(...conditions))
      .limit(10);
  }

  if (eventRows.length === 0) return [];

  const eventIds = eventRows.map((e) => e.id);
  const orgLinks = await db
    .select({
      eventId: orgsEventsInTest.eventId,
      orgId: orgsInTest.id,
      orgName: orgsInTest.name,
      orgDomain: orgsInTest.domain,
    })
    .from(orgsEventsInTest)
    .innerJoin(orgsInTest, eq(orgsInTest.id, orgsEventsInTest.orgId))
    .where(inArray(orgsEventsInTest.eventId, eventIds));

  const orgsByEvent = new Map<
    string,
    Array<{ id: string; name: string; domain: string | null }>
  >();
  for (const link of orgLinks) {
    if (!orgsByEvent.has(link.eventId)) {
      orgsByEvent.set(link.eventId, []);
    }
    orgsByEvent.get(link.eventId)!.push({
      id: link.orgId,
      name: link.orgName,
      domain: link.orgDomain,
    });
  }

  return eventRows.map((e) => ({
    ...e,
    orgs: orgsByEvent.get(e.id) ?? [],
  }));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
