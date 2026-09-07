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
  arrayOverlaps,
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
import { parseAndValidate, ensureLeadingText } from "../../lib/chatValidation";
import type { RequestBody, EventSearchFilters } from "../../interfaces/chat";
import type { EventWithOrgs, Event } from "../../interfaces/event";
import type { OrgWithChatContext } from "../../interfaces/org";

const LLM_API_URL = process.env.SCW_API_LLM_LNK;
const LLM_API_KEY = process.env.SCW_API_KEY;
const LLM_MODEL = "qwen3-235b-a22b-instruct-2507";
const MAX_TOKENS = 2000;
const TEMPERATURE = 0.1;
const LLM_TIMEOUT_MS = 30_000;
// Per-pod backpressure: beyond this many LLM calls in flight, shed load with a
// 503 instead of letting requests pile up until the pod runs out of memory.
const LLM_MAX_CONCURRENT = 20;
let llmInFlight = 0;

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

    // Deterministic preselection: directs the LLM's attention to the organizations
    // whose descriptions match the words in the question (complete directory
    // always provided—no loss if the matching process finds nothing).
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

  if (llmInFlight >= LLM_MAX_CONCURRENT) {
    return json({ error: "Service busy, please retry shortly" }, 503);
  }
  llmInFlight++;
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
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
    if (llmRes.status === 429) {
      console.error("LLM rate limited", await llmRes.text());
      return json({ error: "Service busy, please retry shortly" }, 503);
    }
    if (!llmRes.ok) {
      console.error("LLM error", llmRes.status, await llmRes.text());
      return json({ error: "LLM error" }, 502);
    }
    const llmData = await llmRes.json();
    rawText = llmData?.choices?.[0]?.message?.content;
    //console.log("[chat] full LLM response:", JSON.stringify(llmData, null, 2));  // log to check json integrity
    if (!rawText) {
      return json({ error: "Empty LLM response" }, 502);
    }
    if (typeof rawText !== "string") {
      return json({ error: "Bad LLM response shape" }, 502);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      console.error("LLM call timed out after", LLM_TIMEOUT_MS, "ms");
      return json({ error: "LLM timeout, please retry" }, 504);
    }
    console.error("LLM call failed:", err);
    return json({ error: "LLM call failed" }, 502);
  } finally {
    llmInFlight--;
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

  let hydratedOrgs: OrgWithChatContext[] = [];
  if (allOrgIds.length > 0) {
    try {
      const rows = await db
        .select({
          id: orgsInTest.id,
          name: orgsInTest.name,
          desc: orgsInTest.desc,
          categories: orgsInTest.categories,
          domain: orgsInTest.domain,
          events_url: orgsInTest.eventsUrl,
          news_url: orgsInTest.newsUrl,
          socials: orgsInTest.socials,
          address: orgsInTest.address,
          lat: orgsInTest.lat,
          lon: orgsInTest.lon,
          city: orgsInTest.city,
          rss: orgsInTest.rss,
          contact: orgsInTest.contact,
        })
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
          } as unknown as OrgWithChatContext;
        })
        .filter((x): x is OrgWithChatContext => x !== null);
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
  let eventsResult: { events: EventWithOrgs[]; hasMore: boolean } = {
    events: [],
    hasMore: false,
  };
  if (eventSearchBlock && eventSearchBlock.type === "event_search") {
    try {
      eventsResult = await runEventSearch(eventSearchBlock.filters);
    } catch (err) {
      console.error("Event search failed:", err);
    }
  }

  return json({
    blocks: response.blocks,
    orgs: hydratedOrgs,
    events: eventsResult.events,
    hasMoreEvents: eventsResult.hasMore,
    eventOffset:
      eventSearchBlock?.type === "event_search"
        ? (eventSearchBlock.filters.offset ?? 0)
        : 0,
    fabricatedIdsFiltered: parsed.fabricatedIds.length,
  });
};

async function runEventSearch(
  filters: EventSearchFilters,
): Promise<{ events: EventWithOrgs[]; hasMore: boolean }> {
  const baseConditions: any[] = [];
  const offset = filters.offset ?? 0;
  const LIMIT = 10;

  if (filters.day_of_week !== undefined) {
    baseConditions.push(
      sql`EXTRACT(DOW FROM ${eventsInTest.startDate}) = ${filters.day_of_week}`,
    );
  }

  if (filters.time_of_day) {
    const hourRange = {
      morning: [5, 12],
      afternoon: [12, 18],
      evening: [18, 23],
    }[filters.time_of_day];
    baseConditions.push(
      sql`EXTRACT(HOUR FROM ${eventsInTest.startDate}) >= ${hourRange[0]} AND EXTRACT(HOUR FROM ${eventsInTest.startDate}) < ${hourRange[1]}`,
    );
  }

  if (filters.categories && filters.categories.length > 0) {
    baseConditions.push(
      arrayOverlaps(eventsInTest.categories, filters.categories),
    );
  }

  if (filters.audience) {
    baseConditions.push(
      sql`${filters.audience} = ANY(${eventsInTest.categories})`,
    );
  }

  if (filters.keywords && filters.keywords.length > 0) {
    const keywordConditions = filters.keywords.map((kw) =>
      or(
        ilike(eventsInTest.title, `%${kw}%`),
        ilike(eventsInTest.content, `%${kw}%`),
      ),
    );
    baseConditions.push(or(...keywordConditions));
  }

  const today = new Date().toISOString().slice(0, 10);

  const datedConditions: any[] = [...baseConditions];
  if (filters.date_from) {
    datedConditions.push(gte(eventsInTest.startDate, filters.date_from));
  } else {
    datedConditions.push(
      or(
        gte(eventsInTest.endDate, today),
        and(isNull(eventsInTest.endDate), gte(eventsInTest.startDate, today)),
      ),
    );
  }
  if (filters.date_to) {
    datedConditions.push(lte(eventsInTest.startDate, filters.date_to));
  }
  datedConditions.push(sql`${eventsInTest.startDate} IS NOT NULL`);

  const undatedConditions: any[] = [...baseConditions];
  undatedConditions.push(isNull(eventsInTest.startDate));

  const needsOrgJoin: boolean =
    (filters.city && filters.city.length > 0) ||
    (filters.org_ids && filters.org_ids.length > 0) ||
    false;

  const orgConditions: any[] = [];
  if (filters.city) {
    orgConditions.push(ilike(orgsInTest.city, `%${filters.city}%`));
  }
  if (filters.org_ids && filters.org_ids.length > 0) {
    orgConditions.push(inArray(orgsInTest.id, filters.org_ids));
  }

  const datedFetch: Event[] = await fetchEvents(
    datedConditions,
    orgConditions,
    needsOrgJoin,
    LIMIT + 1,
    offset,
  );
  const hasMoreDated = datedFetch.length > LIMIT;
  const dated = datedFetch.slice(0, LIMIT);

  let undated: typeof dated = [];
  let hasMoreUndated = false;
  if (offset === 0 && !hasMoreDated) {
    const remainingSlots = LIMIT - dated.length;
    if (remainingSlots > 0) {
      const undatedFetch = await fetchEvents(
        undatedConditions,
        orgConditions,
        needsOrgJoin,
        remainingSlots + 1,
        0,
      );
      hasMoreUndated = undatedFetch.length > remainingSlots;
      undated = undatedFetch.slice(0, remainingSlots);
    }
  }

  const eventRows = [...dated, ...undated];
  const hasMore = hasMoreDated || hasMoreUndated;

  if (eventRows.length === 0) return { events: [], hasMore: false };

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

  const events: EventWithOrgs[] = eventRows.map((e) => ({
    ...e,
    orgs: orgsByEvent.get(e.id) ?? [],
  }));

  return { events, hasMore };
}

async function fetchEvents(
  conditions: any[],
  orgConditions: any[],
  needsOrgJoin: boolean,
  limit: number,
  off: number,
) {
  if (limit <= 0) return [];
  if (needsOrgJoin) {
    return db
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
      .orderBy(asc(eventsInTest.startDate))
      .limit(limit)
      .offset(off);
  } else {
    return db
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
      .orderBy(asc(eventsInTest.startDate))
      .limit(limit)
      .offset(off);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
