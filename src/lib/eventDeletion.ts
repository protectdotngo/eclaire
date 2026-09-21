// Pure helpers for the `delete-event` maintenance script
// (scripts/deleteEvent.ts). Mirrors ./orgDeletion: the database work lives in
// the script, everything here is side-effect free so it can be unit-tested
// without a connection (the repo has no DB test harness).

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Printed in place of a NULL date/title so columns still line up.
const NO_VALUE = "—";

// Scraped titles run long ("Announcing a capacity building initiative for
// African and developing country (G77) missions…") and would push the org
// column off the edge of the terminal.
const MAX_TITLE_WIDTH = 56;
const MAX_ORGS_WIDTH = 32;

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1) + "…";
}

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * `start_date` arrives from pg as "2026-01-08 14:00:00" (mode: "string").
 * Only the day matters for identifying an event in a list.
 */
export function formatDay(startDate: string | null): string {
  if (startDate === null || startDate.trim() === "") return NO_VALUE;
  return startDate.slice(0, 10);
}

export type Command =
  | { kind: "help" }
  | { kind: "list"; filter: string | null }
  | {
      kind: "duplicates";
      execute: boolean;
      confirm: string | null;
      backup: string | null;
    }
  | {
      kind: "delete";
      target: string;
      execute: boolean;
      confirm: string | null;
      backup: string | null;
    }
  | { kind: "error"; message: string };

/**
 * Hand-rolled argument parsing, like ./orgDeletion: the project has no CLI
 * dependency and one more destructive script is not a reason to add one.
 */
export function parseArgs(argv: string[]): Command {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { kind: "help" };
  }

  let list = false;
  let duplicates = false;
  let execute = false;
  let confirm: string | null = null;
  let backup: string | null = null;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (arg === "--list") {
      list = true;
      continue;
    }
    if (arg === "--duplicates") {
      duplicates = true;
      continue;
    }
    if (arg === "--execute") {
      execute = true;
      continue;
    }
    if (arg === "--confirm" || arg === "--backup") {
      const value = argv[i + 1];
      // A flag swallowing the next flag as its value is how an operator ends
      // up deleting the wrong thing, so require a real value.
      if (value === undefined || value.startsWith("--")) {
        return { kind: "error", message: `${arg} requires a value` };
      }
      if (arg === "--confirm") confirm = value;
      else backup = value;
      i++;
      continue;
    }
    if (arg.startsWith("-")) {
      return { kind: "error", message: `Unknown flag: ${arg}` };
    }
    positional.push(arg);
  }

  if (list && duplicates) {
    return {
      kind: "error",
      message: "--list cannot be combined with --duplicates",
    };
  }

  if (list) {
    if (positional.length > 1) {
      return { kind: "error", message: "--list takes at most one filter" };
    }
    if (execute || confirm !== null || backup !== null) {
      return {
        kind: "error",
        message:
          "--list cannot be combined with --execute, --confirm or --backup",
      };
    }
    return { kind: "list", filter: positional[0] ?? null };
  }

  if (duplicates) {
    if (positional.length > 0) {
      return {
        kind: "error",
        message:
          "--duplicates takes no event name or id: it sweeps the whole table",
      };
    }
    if (confirm !== null && !execute) {
      return {
        kind: "error",
        message: "--confirm only applies with --execute",
      };
    }
    return { kind: "duplicates", execute, confirm, backup };
  }

  if (positional.length === 0) {
    return { kind: "error", message: "Missing event title or id" };
  }
  if (positional.length > 1) {
    return {
      kind: "error",
      message: `Expected a single event title or id, got ${positional.length}. Quote titles containing spaces.`,
    };
  }

  const target = positional[0]!;
  if (target.trim() === "") {
    return { kind: "error", message: "Missing event title or id" };
  }

  // --confirm only ever answers the prompt that --execute raises; on its own it
  // reads like it triggers the deletion, and would silently dry-run instead.
  if (confirm !== null && !execute) {
    return { kind: "error", message: "--confirm only applies with --execute" };
  }

  // --backup without --execute is allowed on purpose: it exports the rows a
  // deletion would remove, which is a reasonable thing to want before deciding.
  return { kind: "delete", target, execute, confirm, backup };
}

export function confirmationMatches(typed: string, expected: string): boolean {
  return typed.trim() === expected;
}

/**
 * What the operator must type to confirm deleting one event.
 *
 * Titles are nullable and the scrapers do produce empty ones — there is a
 * duplicate group of ten untitled rows in production — so an empty title falls
 * back to the id rather than letting a bare Enter confirm the deletion.
 */
export function confirmationToken(event: {
  id: string;
  title: string | null;
}): string {
  const title = (event.title ?? "").trim();
  return title === "" ? event.id : title;
}

export interface EventListRow {
  id: string;
  title: string | null;
  startDate: string | null;
  orgs: string[];
}

export function formatEventList(rows: EventListRow[]): string {
  if (rows.length === 0) {
    return "No events found.";
  }

  const titles = rows.map((r) =>
    clip((r.title ?? "").trim() || NO_VALUE, MAX_TITLE_WIDTH),
  );
  const titleWidth = Math.max(5, ...titles.map((t) => t.length));
  const orgs = rows.map((r) =>
    clip(r.orgs.length > 0 ? r.orgs.join(", ") : NO_VALUE, MAX_ORGS_WIDTH),
  );
  const orgsWidth = Math.max(4, ...orgs.map((o) => o.length));

  const header = [
    "id".padEnd(36),
    "date".padEnd(10),
    "title".padEnd(titleWidth),
    "orgs".padEnd(orgsWidth),
  ].join("  ");

  const lines = rows.map((r, i) =>
    [
      r.id.padEnd(36),
      formatDay(r.startDate).padEnd(10),
      titles[i]!.padEnd(titleWidth),
      orgs[i]!.padEnd(orgsWidth),
    ].join("  "),
  );

  return [
    header,
    "-".repeat(header.length),
    ...lines,
    "",
    `${rows.length} event${rows.length === 1 ? "" : "s"}.`,
  ].join("\n");
}

export interface EventDeletionPlan {
  event: {
    id: string;
    title: string | null;
    startDate: string | null;
    url: string;
  };
  /** Rows in orgs_events pointing at this event; all of them go. */
  links: number;
  /** Names of the orgs that lose the event, for the operator to sanity-check. */
  orgs: string[];
}

export function formatEventDeletionPlan(plan: EventDeletionPlan): string {
  const orgs =
    plan.orgs.length === 0 ? `  (none)` : plan.orgs.map((o) => `    ${o}`);

  return [
    "Event",
    `  id     ${plan.event.id}`,
    `  title  ${(plan.event.title ?? "").trim() || NO_VALUE}`,
    `  date   ${formatDay(plan.event.startDate)}`,
    `  url    ${plan.event.url}`,
    "",
    "Linked orgs (kept — only the link is removed)",
    ...(typeof orgs === "string" ? [orgs] : orgs),
    "",
    "Rows to delete",
    `  events         1`,
    `  orgs_events    ${plan.links}`,
  ].join("\n");
}

/**
 * One scraped row inside a duplicate group.
 */
export interface DuplicateCopy {
  id: string;
  /** pg timestamp string; the earliest is the original scrape. */
  scrapedAt: string;
  orgIds: string[];
}

/**
 * A set of rows the scrapers produced for what is plainly the same event:
 * identical title and start date. `keepId` is the row that survives.
 */
export interface DuplicateGroup {
  title: string | null;
  startDate: string | null;
  keepId: string;
  deleteIds: string[];
}

/**
 * A group left alone because collapsing it would cost an org its only link to
 * the event. Rare — 3 of 166 groups in production — but silently dropping an
 * org's event is exactly the damage this script must not do.
 */
export interface SkippedDuplicateGroup {
  title: string | null;
  startDate: string | null;
  copies: number;
  /** Orgs that link to a doomed copy and to no surviving one. */
  orphanedOrgIds: string[];
}

export type DuplicateDecision =
  | { kind: "clean"; keepId: string; deleteIds: string[] }
  | { kind: "skip"; keepId: string; orphanedOrgIds: string[] };

/**
 * Decide which copy of a duplicate group survives.
 *
 * Keeps the best-connected row — most org links, then the earliest scrape, then
 * the lowest id — because the join rows are the part that cannot be
 * regenerated from the event itself. If the survivor still would not cover
 * every org in the group, the whole group is skipped rather than half-cleaned.
 */
export function planDuplicateGroup(copies: DuplicateCopy[]): DuplicateDecision {
  const ranked = [...copies].sort(
    (a, b) =>
      b.orgIds.length - a.orgIds.length ||
      a.scrapedAt.localeCompare(b.scrapedAt) ||
      a.id.localeCompare(b.id),
  );
  const keep = ranked[0]!;
  const kept = new Set(keep.orgIds);

  const orphanedOrgIds = [
    ...new Set(
      copies
        .filter((c) => c.id !== keep.id)
        .flatMap((c) => c.orgIds)
        .filter((orgId) => !kept.has(orgId)),
    ),
  ].sort();

  if (orphanedOrgIds.length > 0) {
    return { kind: "skip", keepId: keep.id, orphanedOrgIds };
  }
  return {
    kind: "clean",
    keepId: keep.id,
    deleteIds: ranked.slice(1).map((c) => c.id),
  };
}

export function countRedundant(groups: DuplicateGroup[]): number {
  return groups.reduce((n, g) => n + g.deleteIds.length, 0);
}

export function formatDuplicatePlan(
  groups: DuplicateGroup[],
  skipped: SkippedDuplicateGroup[] = [],
): string {
  if (groups.length === 0 && skipped.length === 0) {
    return "No duplicate events found.";
  }

  const lines: string[] = [];
  for (const g of groups) {
    const title = (g.title ?? "").trim() || NO_VALUE;
    lines.push(
      `${formatDay(g.startDate)}  ${clip(title, MAX_TITLE_WIDTH)}  ` +
        `(${g.deleteIds.length + 1} copies, keeping ${g.keepId})`,
    );
    for (const id of g.deleteIds) lines.push(`    delete  ${id}`);
  }

  if (skipped.length > 0) {
    lines.push(
      "",
      `Skipped ${skipped.length} group${skipped.length === 1 ? "" : "s"}: no single copy` +
        " carries every org link, so collapsing would drop an org's only link." +
        " Resolve these by hand.",
    );
    for (const g of skipped) {
      const title = (g.title ?? "").trim() || NO_VALUE;
      lines.push(
        `    ${formatDay(g.startDate)}  ${clip(title, MAX_TITLE_WIDTH)}` +
          `  (${g.copies} copies, ${g.orphanedOrgIds.length} org link(s) at risk)`,
      );
    }
  }

  const redundant = countRedundant(groups);
  return [
    ...lines,
    "",
    "Rows to delete",
    `  events         ${redundant}  (across ${groups.length} group${groups.length === 1 ? "" : "s"})`,
    "  orgs_events    all rows pointing at those events",
  ].join("\n");
}
