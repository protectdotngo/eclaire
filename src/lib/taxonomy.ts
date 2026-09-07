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
