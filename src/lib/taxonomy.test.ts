import { describe, expect, it } from "vitest";
import { DISPLAY_BUCKETS } from "../data/calendarConfig";
import {
  ALL_CATEGORIES,
  DIGITAL_CATEGORIES,
  hasDigitalCategory,
} from "./taxonomy";

describe("DIGITAL_CATEGORIES", () => {
  it("covers the three digital buckets and nothing else", () => {
    expect([...DIGITAL_CATEGORIES].sort()).toEqual(
      [
        "aide & soutien numérique",
        "aide matérielle & équipement",
        "connectivité publique",
        "cybersécurité & prévention",
        "formation numérique",
        "inclusion & accessibilité numérique",
      ].sort(),
    );
  });

  it("only contains categories that exist in the taxonomy", () => {
    const known = new Set(ALL_CATEGORIES.map((c) => c.name));
    for (const cat of DIGITAL_CATEGORIES) expect(known.has(cat)).toBe(true);
  });

  it("excludes every category of the non-digital buckets", () => {
    const nonDigital = DISPLAY_BUCKETS.filter((b) =>
      ["social", "formation", "institutional", "other"].includes(b.calendarId),
    ).flatMap((b) => b.categories);
    // "formation générale" is the trap: it reads like training but covers
    // cooking, music and language workshops.
    expect(nonDigital).toContain("formation générale");
    for (const cat of nonDigital) expect(DIGITAL_CATEGORIES).not.toContain(cat);
  });
});

describe("hasDigitalCategory", () => {
  it("accepts an event tagged with a digital category", () => {
    expect(hasDigitalCategory(["tout public", "formation numérique"])).toBe(
      true,
    );
  });

  it("rejects an event with only audience and social tags", () => {
    expect(hasDigitalCategory(["tout public", "action & aide sociale"])).toBe(
      false,
    );
  });

  it("rejects an event whose only theme is formation générale", () => {
    expect(hasDigitalCategory(["seniors", "formation générale"])).toBe(false);
  });

  it("accepts when any one of several categories is digital", () => {
    expect(
      hasDigitalCategory([
        "action & aide sociale",
        "femmes",
        "cybersécurité & prévention",
      ]),
    ).toBe(true);
  });

  it("treats an empty array, null and undefined as not digital", () => {
    expect(hasDigitalCategory([])).toBe(false);
    expect(hasDigitalCategory(null)).toBe(false);
    expect(hasDigitalCategory(undefined)).toBe(false);
  });

  it("does not match on substrings or differing case", () => {
    expect(hasDigitalCategory(["numérique"])).toBe(false);
    expect(hasDigitalCategory(["Formation Numérique"])).toBe(false);
  });
});
