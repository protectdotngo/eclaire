import type { EventSearchFilters } from "../interfaces/chat";

/**
 * The resolved time window for an event search, derived from the filters the
 * LLM emitted plus today's date.
 *
 * This lives in its own pure module because `runEventSearch` talks to the
 * database directly and cannot be unit-tested; keeping every date decision
 * here means the part that can actually go wrong is covered by tests.
 */
export interface EventWindow {
  /** Lower bound on `start_date`, ISO `YYYY-MM-DD`. */
  from?: string;
  /** Upper bound on `start_date`, ISO `YYYY-MM-DD`. */
  to?: string;
  /**
   * Apply the "still running or upcoming" floor. Authoritative: the model
   * cannot switch it off by supplying a `date_from`, only by asking for past
   * events explicitly through `include_past`.
   */
  requireNotPast: boolean;
  /** `start_date` sort direction. A window that ends in the past reads
   *  most-recent-first. */
  order: "asc" | "desc";
}

/**
 * Resolve the filters into a window.
 *
 * `today` is passed in rather than read from the clock so the behaviour is
 * deterministic and testable. ISO `YYYY-MM-DD` strings compare correctly with
 * `<=`, so the bounds are compared as plain strings.
 */
export function resolveEventWindow(
  filters: Pick<EventSearchFilters, "date_from" | "date_to" | "include_past">,
  today: string,
): EventWindow {
  const from = filters.date_from;

  if (filters.include_past !== true) {
    // Default: the floor applies whether or not the model gave a range, so a
    // model-chosen `date_from` can only narrow the window, never widen it
    // into the past.
    return { from, to: filters.date_to, requireNotPast: true, order: "asc" };
  }

  // "Show me past events" with no upper bound means "up to today" — without
  // this the query would return every event ever recorded and, sorted
  // most-recent-first, lead with the furthest *future* one.
  //
  // An explicit `date_to` is never clamped down to today: on a window that
  // straddles today ("ce mois-ci") that would silently drop the remaining
  // days, which is the same class of data loss this change exists to fix.
  const to = filters.date_to ?? today;

  return {
    from,
    to,
    requireNotPast: false,
    order: to <= today ? "desc" : "asc",
  };
}
