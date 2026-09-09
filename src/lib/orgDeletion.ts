// Pure helpers for the `delete-org` maintenance script (scripts/deleteOrg.ts).
// The database work lives in the script; everything here is side-effect free so
// it can be unit-tested without a connection (the repo has no DB test harness).

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Printed in place of a NULL city so columns still line up.
const NO_CITY = "—";

// A handful of org names run past 100 characters and would push the counts off
// the edge of the terminal. Not reusing `truncate` from ./text: it imports
// `marked`, which has no business in a CLI or in this module's tests.
const MAX_NAME_WIDTH = 48;
const MAX_CITY_WIDTH = 24;

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1) + "…";
}

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export type Command =
  | { kind: "help" }
  | { kind: "list"; filter: string | null }
  | {
      kind: "delete";
      target: string;
      execute: boolean;
      confirm: string | null;
      backup: string | null;
    }
  | { kind: "error"; message: string };

/**
 * Hand-rolled argument parsing: the project has no CLI dependency and one
 * destructive script is not a reason to add one.
 */
export function parseArgs(argv: string[]): Command {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { kind: "help" };
  }

  let list = false;
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

  if (positional.length === 0) {
    return { kind: "error", message: "Missing org name or id" };
  }
  if (positional.length > 1) {
    return {
      kind: "error",
      message: `Expected a single org name or id, got ${positional.length}. Quote names containing spaces.`,
    };
  }

  const target = positional[0]!;
  if (target.trim() === "") {
    return { kind: "error", message: "Missing org name or id" };
  }

  // --confirm only ever answers the prompt that --execute raises; on its own it
  // reads like it triggers the deletion, and would silently dry-run instead.
  if (confirm !== null && !execute) {
    return {
      kind: "error",
      message: "--confirm only applies with --execute",
    };
  }

  // --backup without --execute is allowed on purpose: it exports the rows a
  // deletion would remove, which is a reasonable thing to want before deciding.
  return { kind: "delete", target, execute, confirm, backup };
}

export function confirmationMatches(typed: string, orgName: string): boolean {
  return typed.trim() === orgName;
}

export interface OrgListRow {
  id: string;
  name: string;
  city: string | null;
  events: number;
  news: number;
}

export function formatOrgList(rows: OrgListRow[]): string {
  if (rows.length === 0) {
    return "No organizations found.";
  }

  const names = rows.map((r) => clip(r.name, MAX_NAME_WIDTH));
  const nameWidth = Math.max(4, ...names.map((n) => n.length));
  const cities = rows.map((r) => clip(r.city ?? NO_CITY, MAX_CITY_WIDTH));
  const cityWidth = Math.max(4, ...cities.map((c) => c.length));

  const header = [
    "id".padEnd(36),
    "name".padEnd(nameWidth),
    "city".padEnd(cityWidth),
    "events".padStart(6),
    "news".padStart(5),
  ].join("  ");

  const lines = rows.map((r, i) =>
    [
      r.id.padEnd(36),
      names[i]!.padEnd(nameWidth),
      cities[i]!.padEnd(cityWidth),
      String(r.events).padStart(6),
      String(r.news).padStart(5),
    ].join("  "),
  );

  return [
    header,
    "-".repeat(header.length),
    ...lines,
    "",
    `${rows.length} organization${rows.length === 1 ? "" : "s"}.`,
  ].join("\n");
}

export interface DeletionPlan {
  org: { id: string; name: string; city: string | null };
  /** Events linked to this org, shared ones included. */
  linkedEvents: number;
  /** Of those, the ones linked to no other org — the only ones deleted. */
  orphanEvents: number;
  linkedNews: number;
  orphanNews: number;
  propositions: number;
}

export function formatDeletionPlan(plan: DeletionPlan): string {
  const sharedEvents = plan.linkedEvents - plan.orphanEvents;
  const sharedNews = plan.linkedNews - plan.orphanNews;

  const kept = (shared: number) =>
    shared > 0 ? `  (${shared} shared with another org, kept)` : "";

  return [
    "Organization",
    `  id    ${plan.org.id}`,
    `  name  ${plan.org.name}`,
    `  city  ${plan.org.city ?? NO_CITY}`,
    "",
    "Rows to delete",
    `  events         ${plan.orphanEvents}${kept(sharedEvents)}`,
    `  news           ${plan.orphanNews}${kept(sharedNews)}`,
    `  orgs_events    ${plan.linkedEvents}`,
    `  orgs_news      ${plan.linkedNews}`,
    `  propositions   ${plan.propositions}  (their proposition_verifications cascade)`,
    `  orgs           1`,
  ].join("\n");
}
