import type { CalendarType, CalendarEventExternal } from "@schedule-x/calendar";
import type { DisplayBucket } from "../interfaces/displayBucket";
import { AUDIENCE_TAGS } from "./audienceTags";
import { DISPLAY_BUCKETS } from "./calendarConfig";

export const AUDIENCE_SET = new Set<string>(AUDIENCE_TAGS);
export const BUCKET_IDS = new Set(DISPLAY_BUCKETS.map((b) => b.calendarId));

const categoryToBucket = new Map<string, DisplayBucket>();
for (const bucket of DISPLAY_BUCKETS) {
  for (const cat of bucket.categories) {
    categoryToBucket.set(cat, bucket);
  }
}

export const OTHER_BUCKET = DISPLAY_BUCKETS.find(
  (b) => b.calendarId === "other",
)!;

export function splitEventTags(categories: string[]): {
  buckets: DisplayBucket[];
  audiences: string[];
} {
  const buckets = new Set<DisplayBucket>();
  const audiences: string[] = [];

  for (const cat of categories) {
    const bucket = categoryToBucket.get(cat);
    if (bucket) {
      buckets.add(bucket);
    } else if (AUDIENCE_SET.has(cat)) {
      audiences.push(cat);
    }
  }

  if (buckets.size === 0) {
    buckets.add(OTHER_BUCKET);
  }

  return { buckets: [...buckets], audiences };
}

export function buildCalendars(): Record<string, CalendarType> {
  return Object.fromEntries(
    DISPLAY_BUCKETS.map((b) => [
      b.calendarId,
      {
        colorName: b.calendarId,
        lightColors: { ...b.colors.light },
        darkColors: { ...b.colors.dark },
      },
    ]),
  );
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}

export function renderEventContent(
  title: string,
  buckets: DisplayBucket[],
): string {
  const dots = buckets
    .map(
      (b) =>
        `<span class="event-tag-dot" style="background:${b.colors.light.main}" title="${escapeHtml(b.label)}"></span>`,
    )
    .join("");

  return `
    <div class="event-content">
      <div class="event-tags">${dots}</div>
      <div class="event-title">${escapeHtml(title)}</div>
    </div>
  `;
}
