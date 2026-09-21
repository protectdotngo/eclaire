import { DISPLAY_BUCKETS } from "../data/calendarConfig";
import { AUDIENCE_TAGS } from "../data/audienceTags";

/**
 * Shared taxonomy: thematic categories and target audiences.
 *
 * This computation existed identically in `calendarState.ts` and in
 * `propose/FieldCategories.astro`, and `mapSearch/FiltersPanel.astro` imported
 * the calendar's copy — a map component that therefore depended on calendar
 * state. It now lives here, with no dependency on flatpickr (which
 * `calendarState.ts` imports at module level, and which consequently ended up
 * in the homepage bundle).
 */
export const ALL_CATEGORIES = DISPLAY_BUCKETS.flatMap((bucket) =>
  bucket.categories.map((cat) => ({
    name: cat,
    label: cat.charAt(0).toUpperCase() + cat.slice(1),
    color: bucket.colors.light.main,
    bg: bucket.colors.light.container,
    text: bucket.colors.light.onContainer,
  })),
);

export const AUDIENCES = AUDIENCE_TAGS.map((tag) => ({
  name: tag,
  label: tag.charAt(0).toUpperCase() + tag.slice(1),
}));

export type CategoryTag = (typeof ALL_CATEGORIES)[number];
export type AudienceTag = (typeof AUDIENCES)[number];

/**
 * The display buckets whose events are about digital/technological matters and
 * support. Named by `calendarId` rather than by listing the categories again:
 * a category added to one of these buckets in `calendarConfig.ts` must count as
 * digital without anyone remembering to update a second list.
 */
const DIGITAL_BUCKET_IDS = [
  "digital_learning",
  "digital_help",
  "cybersecurity",
];

/**
 * Thematic categories that mark an event as digital. Used by
 * `/api/dataEvents` to filter at the database rather than in the browser.
 */
export const DIGITAL_CATEGORIES: string[] = DISPLAY_BUCKETS.filter((b) =>
  DIGITAL_BUCKET_IDS.includes(b.calendarId),
).flatMap((b) => b.categories);

/**
 * Does an event's `categories` array mark it as digital?
 *
 * The API filters in SQL (`categories && DIGITAL_CATEGORIES`); this is the same
 * predicate in TypeScript, for callers that already hold the rows — and the one
 * the tests can exercise without a database.
 */
export function hasDigitalCategory(
  categories: readonly string[] | null | undefined,
): boolean {
  if (!categories) return false;
  return categories.some((c) => DIGITAL_CATEGORIES.includes(c));
}
