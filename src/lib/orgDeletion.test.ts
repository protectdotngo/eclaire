import { describe, expect, it } from "vitest";
import {
  confirmationMatches,
  formatDeletionPlan,
  formatOrgList,
  isUuid,
  parseArgs,
  type DeletionPlan,
  type OrgListRow,
} from "./orgDeletion";

const ORG_UUID = "3f8a1c2d-4b5e-4a7f-9c0d-1e2f3a4b5c6d";

// Placeholder printed for a NULL city; the alignment test pins it down.
const NO_CITY = "\u2014";

const PLAN: DeletionPlan = {
  org: { id: ORG_UUID, name: "Atelier Numérique", city: "Genève" },
  linkedEvents: 5,
  orphanEvents: 3,
  linkedNews: 1,
  orphanNews: 1,
  propositions: 2,
};

describe("isUuid", () => {
  it("accepts a canonical UUID", () => {
    expect(isUuid(ORG_UUID)).toBe(true);
  });

  it("accepts an uppercase UUID", () => {
    expect(isUuid(ORG_UUID.toUpperCase())).toBe(true);
  });

  it("rejects an org name", () => {
    expect(isUuid("Atelier Numérique")).toBe(false);
  });

  it("rejects a truncated UUID", () => {
    expect(isUuid(ORG_UUID.slice(0, -1))).toBe(false);
  });

  it("rejects a UUID with surrounding whitespace", () => {
    expect(isUuid(` ${ORG_UUID} `)).toBe(false);
  });
});

describe("parseArgs", () => {
  it("treats no arguments as a help request", () => {
    expect(parseArgs([])).toEqual({ kind: "help" });
  });

  it("treats --help and -h as a help request", () => {
    expect(parseArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseArgs(["-h"])).toEqual({ kind: "help" });
  });

  it("parses --list with no filter", () => {
    expect(parseArgs(["--list"])).toEqual({ kind: "list", filter: null });
  });

  it("parses --list with a filter", () => {
    expect(parseArgs(["--list", "biblio"])).toEqual({
      kind: "list",
      filter: "biblio",
    });
  });

  it("defaults to a dry run when only a target is given", () => {
    expect(parseArgs(["Atelier Numérique"])).toEqual({
      kind: "delete",
      target: "Atelier Numérique",
      execute: false,
      confirm: null,
      backup: null,
    });
  });

  it("parses --execute", () => {
    const cmd = parseArgs(["Atelier Numérique", "--execute"]);
    expect(cmd).toMatchObject({ kind: "delete", execute: true });
  });

  it("accepts flags before the target", () => {
    expect(parseArgs(["--execute", ORG_UUID])).toMatchObject({
      kind: "delete",
      target: ORG_UUID,
      execute: true,
    });
  });

  it("parses --confirm and --backup", () => {
    expect(
      parseArgs([
        "Atelier Numérique",
        "--execute",
        "--confirm",
        "Atelier Numérique",
        "--backup",
        "/tmp/dump.json",
      ]),
    ).toEqual({
      kind: "delete",
      target: "Atelier Numérique",
      execute: true,
      confirm: "Atelier Numérique",
      backup: "/tmp/dump.json",
    });
  });

  it("allows --backup during a dry run, so data can be exported without deleting", () => {
    expect(parseArgs(["Atelier Numérique", "--backup", "/tmp/d.json"])).toEqual(
      {
        kind: "delete",
        target: "Atelier Numérique",
        execute: false,
        confirm: null,
        backup: "/tmp/d.json",
      },
    );
  });

  it("rejects --confirm without --execute, which would silently do nothing", () => {
    const cmd = parseArgs([
      "Atelier Numérique",
      "--confirm",
      "Atelier Numérique",
    ]);
    expect(cmd.kind).toBe("error");
  });

  it("rejects an unknown flag rather than treating it as a target", () => {
    const cmd = parseArgs(["Atelier Numérique", "--force"]);
    expect(cmd).toEqual({
      kind: "error",
      message: "Unknown flag: --force",
    });
  });

  it("rejects a flag that is missing its value", () => {
    expect(parseArgs(["Org", "--execute", "--confirm"]).kind).toBe("error");
    expect(parseArgs(["Org", "--backup"]).kind).toBe("error");
  });

  it("rejects two targets, which is usually a missing pair of quotes", () => {
    const cmd = parseArgs(["Atelier", "Numérique"]);
    expect(cmd.kind).toBe("error");
  });

  it("rejects an empty target", () => {
    expect(parseArgs([""]).kind).toBe("error");
  });
});

describe("confirmationMatches", () => {
  it("accepts the exact name", () => {
    expect(confirmationMatches("Atelier Numérique", "Atelier Numérique")).toBe(
      true,
    );
  });

  it("accepts the name with stray surrounding whitespace", () => {
    expect(
      confirmationMatches("  Atelier Numérique\n", "Atelier Numérique"),
    ).toBe(true);
  });

  it("rejects a different case, so the operator has to read what they type", () => {
    expect(confirmationMatches("atelier numérique", "Atelier Numérique")).toBe(
      false,
    );
  });

  it("rejects a near miss", () => {
    expect(confirmationMatches("Atelier Numerique", "Atelier Numérique")).toBe(
      false,
    );
  });

  it("rejects an empty answer", () => {
    expect(confirmationMatches("", "Atelier Numérique")).toBe(false);
    expect(confirmationMatches("   ", "Atelier Numérique")).toBe(false);
  });
});

describe("formatOrgList", () => {
  const ROWS: OrgListRow[] = [
    {
      id: ORG_UUID,
      name: "Atelier Numérique",
      city: "Genève",
      events: 12,
      news: 3,
    },
    {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      name: "Bibliothèque",
      city: null,
      events: 0,
      news: 0,
    },
  ];

  it("says so plainly when there is nothing to show", () => {
    expect(formatOrgList([])).toContain("No organizations found");
  });

  it("lists every org with its id, name and counts", () => {
    const out = formatOrgList(ROWS);
    expect(out).toContain(ORG_UUID);
    expect(out).toContain("Atelier Numérique");
    expect(out).toContain("Bibliothèque");
    expect(out).toContain("Genève");
  });

  it("pads the name column so later columns line up", () => {
    // The two names differ in length, so the city column only lands at the
    // same offset if names are padded to the widest one.
    const lines = formatOrgList(ROWS).split("\n");
    const withCity = lines.find((l) => l.startsWith(ORG_UUID))!;
    const withoutCity = lines.find((l) => l.startsWith("aaaaaaaa"))!;
    expect(withCity.indexOf("Genève")).toBe(withoutCity.indexOf(NO_CITY));
  });

  it("reports a total count", () => {
    expect(formatOrgList(ROWS)).toContain("2");
  });
});

describe("formatDeletionPlan", () => {
  it("names the org being deleted", () => {
    const out = formatDeletionPlan(PLAN);
    expect(out).toContain("Atelier Numérique");
    expect(out).toContain(ORG_UUID);
  });

  it("splits orphaned rows from rows shared with other orgs", () => {
    const out = formatDeletionPlan(PLAN);
    // 5 linked, 3 orphaned -> 2 shared and therefore kept.
    expect(out).toMatch(/events\s+3\b/);
    expect(out).toMatch(/2 shared with another org, kept/);
    // The join rows all go, shared or not.
    expect(out).toMatch(/orgs_events\s+5\b/);
  });

  it("mentions propositions and their cascading verifications", () => {
    const out = formatDeletionPlan(PLAN);
    expect(out).toContain("propositions");
    expect(out).toMatch(/verification/i);
  });

  it("handles an org with no attached data at all", () => {
    const out = formatDeletionPlan({
      org: { id: ORG_UUID, name: "Empty", city: null },
      linkedEvents: 0,
      orphanEvents: 0,
      linkedNews: 0,
      orphanNews: 0,
      propositions: 0,
    });
    expect(out).toContain("Empty");
    expect(out).not.toMatch(/NaN|undefined/);
  });

  it("does not claim anything is kept when nothing is shared", () => {
    const out = formatDeletionPlan({
      ...PLAN,
      linkedEvents: 3,
      orphanEvents: 3,
      linkedNews: 1,
      orphanNews: 1,
    });
    expect(out).not.toMatch(/kept/i);
  });
});

describe("formatOrgList column width", () => {
  const LONG =
    "Association pour le Bien des Aveugles et Malvoyants et bien plus encore";

  it("clips a very long name so the counts stay on screen", () => {
    const out = formatOrgList([
      { id: ORG_UUID, name: LONG, city: "Genève", events: 1, news: 2 },
    ]);
    expect(out).not.toContain(LONG);
    expect(out).toContain("…");
    // Worst case: 36-char uuid + 48 name + 24 city + counts + separators.
    for (const line of out.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(127);
    }
  });

  it("leaves a short name untouched", () => {
    const out = formatOrgList([
      { id: ORG_UUID, name: "AVIVO Genève", city: null, events: 0, news: 0 },
    ]);
    expect(out).toContain("AVIVO Genève");
    expect(out).not.toContain("…");
  });
});
