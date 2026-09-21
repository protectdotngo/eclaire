import { describe, expect, it } from "vitest";
import {
  confirmationMatches,
  confirmationToken,
  countRedundant,
  formatDay,
  formatDuplicatePlan,
  formatEventDeletionPlan,
  formatEventList,
  isUuid,
  parseArgs,
  planDuplicateGroup,
  type DuplicateCopy,
  type DuplicateGroup,
  type SkippedDuplicateGroup,
  type EventDeletionPlan,
  type EventListRow,
} from "./eventDeletion";

const EVENT_UUID = "3f8a1c2d-4b5e-4a7f-9c0d-1e2f3a4b5c6d";
const OTHER_UUID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

// Placeholder printed for a NULL title or date; the alignment tests pin it down.
const NO_VALUE = "—";

const PLAN: EventDeletionPlan = {
  event: {
    id: EVENT_UUID,
    title: "Permanence Numérique - Rive droite",
    startDate: "2026-01-29 14:00:00",
    url: "https://example.org/events/permanence",
  },
  links: 2,
  orgs: ["Réseau Inclusion Numérique — Ville de Genève", "Cité Seniors"],
};

describe("isUuid", () => {
  it("accepts a canonical UUID", () => {
    expect(isUuid(EVENT_UUID)).toBe(true);
  });

  it("accepts an uppercase UUID", () => {
    expect(isUuid(EVENT_UUID.toUpperCase())).toBe(true);
  });

  it("rejects an event title", () => {
    expect(isUuid("Atelier informatique")).toBe(false);
  });

  it("rejects a truncated UUID", () => {
    expect(isUuid(EVENT_UUID.slice(0, -1))).toBe(false);
  });
});

describe("formatDay", () => {
  it("keeps only the date part of a pg timestamp string", () => {
    expect(formatDay("2026-01-29 14:00:00")).toBe("2026-01-29");
  });

  it("passes a bare date through", () => {
    expect(formatDay("2026-01-29")).toBe("2026-01-29");
  });

  it("renders null and blank as the placeholder", () => {
    expect(formatDay(null)).toBe(NO_VALUE);
    expect(formatDay("   ")).toBe(NO_VALUE);
  });
});

describe("parseArgs", () => {
  it("treats no arguments as help", () => {
    expect(parseArgs([])).toEqual({ kind: "help" });
  });

  it("treats --help and -h as help", () => {
    expect(parseArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseArgs(["-h"])).toEqual({ kind: "help" });
  });

  it("parses --list with and without a filter", () => {
    expect(parseArgs(["--list"])).toEqual({ kind: "list", filter: null });
    expect(parseArgs(["--list", "OpenLab"])).toEqual({
      kind: "list",
      filter: "OpenLab",
    });
  });

  it("rejects --list with more than one filter", () => {
    expect(parseArgs(["--list", "a", "b"]).kind).toBe("error");
  });

  it("rejects --list combined with a destructive flag", () => {
    expect(parseArgs(["--list", "--execute"]).kind).toBe("error");
    expect(parseArgs(["--list", "--backup", "b.json"]).kind).toBe("error");
  });

  it("rejects --list combined with --duplicates", () => {
    expect(parseArgs(["--list", "--duplicates"]).kind).toBe("error");
  });

  it("defaults a bare target to a dry run", () => {
    expect(parseArgs(["OpenLab"])).toEqual({
      kind: "delete",
      target: "OpenLab",
      execute: false,
      confirm: null,
      backup: null,
    });
  });

  it("parses a full delete invocation", () => {
    expect(
      parseArgs([
        EVENT_UUID,
        "--execute",
        "--confirm",
        "OpenLab",
        "--backup",
        "out.json",
      ]),
    ).toEqual({
      kind: "delete",
      target: EVENT_UUID,
      execute: true,
      confirm: "OpenLab",
      backup: "out.json",
    });
  });

  it("allows --backup on a dry run, as a plain export", () => {
    expect(parseArgs([EVENT_UUID, "--backup", "out.json"])).toEqual({
      kind: "delete",
      target: EVENT_UUID,
      execute: false,
      confirm: null,
      backup: "out.json",
    });
  });

  it("rejects --confirm without --execute, which would silently dry-run", () => {
    expect(parseArgs([EVENT_UUID, "--confirm", "OpenLab"]).kind).toBe("error");
    expect(parseArgs(["--duplicates", "--confirm", "3"]).kind).toBe("error");
  });

  it("rejects a flag that swallows the next flag as its value", () => {
    expect(parseArgs([EVENT_UUID, "--confirm", "--execute"]).kind).toBe(
      "error",
    );
    expect(parseArgs([EVENT_UUID, "--backup"]).kind).toBe("error");
  });

  it("rejects an unknown flag", () => {
    const cmd = parseArgs([EVENT_UUID, "--force"]);
    expect(cmd.kind).toBe("error");
    expect(cmd.kind === "error" && cmd.message).toContain("--force");
  });

  it("rejects several positionals, hinting at quoting", () => {
    const cmd = parseArgs(["Atelier", "informatique"]);
    expect(cmd.kind).toBe("error");
    expect(cmd.kind === "error" && cmd.message).toContain("Quote");
  });

  it("rejects a missing or blank target", () => {
    expect(parseArgs(["--execute"]).kind).toBe("error");
    expect(parseArgs(["   "]).kind).toBe("error");
  });

  it("parses --duplicates as a dry run by default", () => {
    expect(parseArgs(["--duplicates"])).toEqual({
      kind: "duplicates",
      execute: false,
      confirm: null,
      backup: null,
    });
  });

  it("parses --duplicates with --execute and --backup", () => {
    expect(
      parseArgs(["--duplicates", "--execute", "--backup", "dupes.json"]),
    ).toEqual({
      kind: "duplicates",
      execute: true,
      confirm: null,
      backup: "dupes.json",
    });
  });

  it("rejects a target alongside --duplicates", () => {
    expect(parseArgs(["--duplicates", "OpenLab"]).kind).toBe("error");
  });
});

describe("confirmationMatches", () => {
  it("accepts the exact expected token", () => {
    expect(confirmationMatches("OpenLab", "OpenLab")).toBe(true);
  });

  it("ignores surrounding whitespace from the terminal", () => {
    expect(confirmationMatches("  OpenLab \n", "OpenLab")).toBe(true);
  });

  it("rejects a different case or a near miss", () => {
    expect(confirmationMatches("openlab", "OpenLab")).toBe(false);
    expect(confirmationMatches("OpenLa", "OpenLab")).toBe(false);
  });

  it("rejects an empty answer", () => {
    expect(confirmationMatches("", "OpenLab")).toBe(false);
    expect(confirmationMatches("   ", "OpenLab")).toBe(false);
  });
});

describe("confirmationToken", () => {
  it("is the title when there is one", () => {
    expect(confirmationToken({ id: EVENT_UUID, title: "OpenLab" })).toBe(
      "OpenLab",
    );
  });

  it("trims the title", () => {
    expect(confirmationToken({ id: EVENT_UUID, title: "  OpenLab  " })).toBe(
      "OpenLab",
    );
  });

  it("falls back to the id for a null or blank title, so Enter cannot confirm", () => {
    expect(confirmationToken({ id: EVENT_UUID, title: null })).toBe(EVENT_UUID);
    expect(confirmationToken({ id: EVENT_UUID, title: "   " })).toBe(
      EVENT_UUID,
    );
    expect(
      confirmationMatches(
        "",
        confirmationToken({ id: EVENT_UUID, title: null }),
      ),
    ).toBe(false);
  });
});

describe("formatEventList", () => {
  const ROWS: EventListRow[] = [
    {
      id: EVENT_UUID,
      title: "OpenLab",
      startDate: "2026-01-29 14:00:00",
      orgs: ["Repair-Café de Genthod"],
    },
    {
      id: OTHER_UUID,
      title: null,
      startDate: null,
      orgs: [],
    },
  ];

  it("says so when there is nothing to show", () => {
    expect(formatEventList([])).toBe("No events found.");
  });

  it("renders one line per event plus a header, rule and count", () => {
    const lines = formatEventList(ROWS).split("\n");
    expect(lines[0]).toContain("title");
    expect(lines[1]).toMatch(/^-+$/);
    expect(lines[2]).toContain("OpenLab");
    expect(lines.at(-1)).toBe("2 events.");
  });

  it("aligns the columns and fills nulls with a placeholder", () => {
    const lines = formatEventList(ROWS).split("\n");
    expect(lines[2]!.length).toBe(lines[3]!.length);
    expect(lines[3]).toContain(NO_VALUE);
  });

  it("uses the singular for a single event", () => {
    expect(formatEventList([ROWS[0]!]).split("\n").at(-1)).toBe("1 event.");
  });

  it("clips a title that would break the layout", () => {
    const long = "x".repeat(200);
    const out = formatEventList([{ ...ROWS[0]!, title: long }]);
    expect(out).not.toContain(long);
    expect(out).toContain("…");
  });

  it("joins several orgs onto the one line", () => {
    const out = formatEventList([{ ...ROWS[0]!, orgs: ["Alpha", "Beta"] }]);
    expect(out).toContain("Alpha, Beta");
  });
});

describe("formatEventDeletionPlan", () => {
  it("reports the event's identity and what goes", () => {
    const out = formatEventDeletionPlan(PLAN);
    expect(out).toContain(EVENT_UUID);
    expect(out).toContain("Permanence Numérique - Rive droite");
    expect(out).toContain("2026-01-29");
    expect(out).toContain("https://example.org/events/permanence");
    expect(out).toContain("events         1");
    expect(out).toContain("orgs_events    2");
  });

  it("makes clear the orgs themselves are kept", () => {
    const out = formatEventDeletionPlan(PLAN);
    expect(out).toContain("kept");
    expect(out).toContain("Cité Seniors");
  });

  it("handles an event with no linked org", () => {
    const out = formatEventDeletionPlan({ ...PLAN, links: 0, orgs: [] });
    expect(out).toContain("(none)");
    expect(out).toContain("orgs_events    0");
  });

  it("falls back to a placeholder for a null title", () => {
    expect(
      formatEventDeletionPlan({
        ...PLAN,
        event: { ...PLAN.event, title: null },
      }),
    ).toContain(`title  ${NO_VALUE}`);
  });
});

describe("duplicate groups", () => {
  const GROUPS: DuplicateGroup[] = [
    {
      title: "OpenLab",
      startDate: "2026-02-05 00:00:00",
      keepId: EVENT_UUID,
      deleteIds: [OTHER_UUID, "11111111-2222-4333-8444-555555555555"],
    },
    {
      title: null,
      startDate: "2026-03-01 00:00:00",
      keepId: OTHER_UUID,
      deleteIds: [EVENT_UUID],
    },
  ];

  it("counts the redundant rows, not the groups", () => {
    expect(countRedundant(GROUPS)).toBe(3);
    expect(countRedundant([])).toBe(0);
  });

  it("says so when there is nothing to clean", () => {
    expect(formatDuplicatePlan([])).toBe("No duplicate events found.");
  });

  it("names the surviving row and every row that goes", () => {
    const out = formatDuplicatePlan(GROUPS);
    expect(out).toContain(`keeping ${EVENT_UUID}`);
    expect(out).toContain(`delete  ${OTHER_UUID}`);
    expect(out).toContain("3 copies");
  });

  it("totals the rows and the groups", () => {
    const out = formatDuplicatePlan(GROUPS);
    expect(out).toContain("events         3  (across 2 groups)");
  });

  it("uses the singular for a single group", () => {
    expect(formatDuplicatePlan([GROUPS[0]!])).toContain("(across 1 group)");
  });

  it("renders a null title as the placeholder", () => {
    expect(formatDuplicatePlan([GROUPS[1]!])).toContain(NO_VALUE);
  });
});

describe("planDuplicateGroup", () => {
  const ORG_A = "aaaaaaaa-0000-4000-8000-000000000001";
  const ORG_B = "bbbbbbbb-0000-4000-8000-000000000002";

  const copy = (over: Partial<DuplicateCopy>): DuplicateCopy => ({
    id: EVENT_UUID,
    scrapedAt: "2026-01-01 00:00:00",
    orgIds: [ORG_A],
    ...over,
  });

  it("keeps the copy with the most org links", () => {
    const d = planDuplicateGroup([
      copy({ id: "a", orgIds: [ORG_A] }),
      copy({ id: "b", orgIds: [ORG_A, ORG_B] }),
    ]);
    expect(d).toEqual({ kind: "clean", keepId: "b", deleteIds: ["a"] });
  });

  it("breaks a tie on link count by the earliest scrape", () => {
    const d = planDuplicateGroup([
      copy({ id: "new", scrapedAt: "2026-05-01 00:00:00" }),
      copy({ id: "old", scrapedAt: "2026-01-01 00:00:00" }),
    ]);
    expect(d.keepId).toBe("old");
  });

  it("breaks a full tie deterministically on id", () => {
    const a = planDuplicateGroup([copy({ id: "z" }), copy({ id: "a" })]);
    const b = planDuplicateGroup([copy({ id: "a" }), copy({ id: "z" })]);
    expect(a.keepId).toBe("a");
    expect(b.keepId).toBe("a");
  });

  it("deletes every copy but the survivor", () => {
    const d = planDuplicateGroup([
      copy({ id: "a" }),
      copy({ id: "b" }),
      copy({ id: "c" }),
    ]);
    expect(d.kind).toBe("clean");
    expect(d.kind === "clean" && d.deleteIds.sort()).toEqual(["b", "c"]);
  });

  it("skips the group when no copy covers every org link", () => {
    const d = planDuplicateGroup([
      copy({ id: "a", orgIds: [ORG_A] }),
      copy({ id: "b", orgIds: [ORG_B] }),
    ]);
    // Both copies tie on link count, so "a" wins on id — and ORG_B, which only
    // "b" carries, would lose its link.
    expect(d).toEqual({ kind: "skip", keepId: "a", orphanedOrgIds: [ORG_B] });
  });

  it("names exactly the orgs that would lose their link", () => {
    const d = planDuplicateGroup([
      copy({ id: "a", orgIds: [ORG_A, ORG_B] }),
      copy({ id: "b", orgIds: ["cccccccc-0000-4000-8000-000000000003"] }),
    ]);
    expect(d).toEqual({
      kind: "skip",
      keepId: "a",
      orphanedOrgIds: ["cccccccc-0000-4000-8000-000000000003"],
    });
  });

  it("cleans a group whose copies share the same single org", () => {
    const d = planDuplicateGroup([
      copy({ id: "a", orgIds: [ORG_A] }),
      copy({ id: "b", orgIds: [ORG_A] }),
    ]);
    expect(d.kind).toBe("clean");
  });

  it("cleans a group where the doomed copies carry no links at all", () => {
    const d = planDuplicateGroup([
      copy({ id: "a", orgIds: [ORG_A] }),
      copy({ id: "b", orgIds: [] }),
    ]);
    expect(d).toEqual({ kind: "clean", keepId: "a", deleteIds: ["b"] });
  });
});

describe("formatDuplicatePlan with skipped groups", () => {
  const SKIPPED: SkippedDuplicateGroup[] = [
    {
      title: "Conférence de jardinage",
      startDate: "2026-04-02 00:00:00",
      copies: 2,
      orphanedOrgIds: ["aaaaaaaa-0000-4000-8000-000000000001"],
    },
  ];

  it("reports skipped groups and why", () => {
    const out = formatDuplicatePlan([], SKIPPED);
    expect(out).toContain("Skipped 1 group");
    expect(out).toContain("only link");
    expect(out).toContain("Conférence de jardinage");
    expect(out).toContain("events         0");
  });

  it("is not 'no duplicates' when everything was skipped", () => {
    expect(formatDuplicatePlan([], SKIPPED)).not.toBe(
      "No duplicate events found.",
    );
  });

  it("still says nothing found when both lists are empty", () => {
    expect(formatDuplicatePlan([], [])).toBe("No duplicate events found.");
  });
});
