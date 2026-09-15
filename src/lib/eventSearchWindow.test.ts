import { describe, it, expect } from "vitest";
import { resolveEventWindow } from "./eventSearchWindow";

const TODAY = "2026-09-15";

describe("resolveEventWindow", () => {
  it("applies the floor when no dates are given", () => {
    expect(resolveEventWindow({}, TODAY)).toEqual({
      from: undefined,
      to: undefined,
      requireNotPast: true,
      order: "asc",
    });
  });

  // The regression test for the reported bug: before this change a
  // model-supplied date_from moved the floor into the else branch and past
  // events leaked through.
  it("keeps the floor even when the model supplies a past date range", () => {
    expect(
      resolveEventWindow(
        { date_from: "2026-07-01", date_to: "2026-07-31" },
        TODAY,
      ),
    ).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
      requireNotPast: true,
      order: "asc",
    });
  });

  it("keeps the floor when only date_to is given", () => {
    expect(resolveEventWindow({ date_to: "2026-07-31" }, TODAY)).toEqual({
      from: undefined,
      to: "2026-07-31",
      requireNotPast: true,
      order: "asc",
    });
  });

  it("lifts the floor when include_past is set", () => {
    expect(
      resolveEventWindow({ include_past: true }, TODAY).requireNotPast,
    ).toBe(false);
  });

  it("bounds an unbounded include_past at today, most recent first", () => {
    expect(resolveEventWindow({ include_past: true }, TODAY)).toEqual({
      from: undefined,
      to: TODAY,
      requireNotPast: false,
      order: "desc",
    });
  });

  it("bounds include_past at today when only date_from is given", () => {
    expect(
      resolveEventWindow(
        { date_from: "2026-01-01", include_past: true },
        TODAY,
      ),
    ).toEqual({
      from: "2026-01-01",
      to: TODAY,
      requireNotPast: false,
      order: "desc",
    });
  });

  it("orders a fully past window most recent first", () => {
    expect(
      resolveEventWindow(
        { date_from: "2026-07-01", date_to: "2026-07-31", include_past: true },
        TODAY,
      ).order,
    ).toBe("desc");
  });

  it("keeps chronological order when include_past straddles today", () => {
    // "ce mois-ci" on the 15th: the explicit date_to is left alone rather than
    // clamped to today, so the rest of the month is not silently dropped.
    expect(
      resolveEventWindow(
        { date_from: "2026-09-01", date_to: "2026-09-30", include_past: true },
        TODAY,
      ),
    ).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
      requireNotPast: false,
      order: "asc",
    });
  });

  it("orders a purely future include_past window chronologically", () => {
    expect(
      resolveEventWindow(
        { date_from: "2026-12-01", date_to: "2026-12-31", include_past: true },
        TODAY,
      ).order,
    ).toBe("asc");
  });

  it("treats a window ending exactly today as past", () => {
    expect(
      resolveEventWindow({ date_to: TODAY, include_past: true }, TODAY).order,
    ).toBe("desc");
  });
});
