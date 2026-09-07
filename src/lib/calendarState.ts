import type { Org, OrgSummary } from "../interfaces/org";
import type { EventWithOrgIds } from "../interfaces/event";
import type { ProcessedEvent } from "../interfaces/calendar";
import { ALL_CATEGORIES } from "./taxonomy";

// Re-exported so existing importers keep working during the migration.
export { ALL_CATEGORIES, AUDIENCES } from "./taxonomy";

export const FRENCH_MONTHS = [
  "janv",
  "fév",
  "mars",
  "avr",
  "mai",
  "juin",
  "juil",
  "août",
  "sept",
  "oct",
  "nov",
  "déc",
];

export const FRENCH_MONTHS_FULL = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseDate(str: string): Date | null {
  const iso = str.includes(" ") ? str.replace(" ", "T") : str + "T00:00:00";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function hasTime(dateStr: string): boolean {
  if (!dateStr.includes(" ")) return false;
  const timePart = dateStr.split(" ")[1];
  return timePart !== "00:00:00";
}

export function processEvents(raw: EventWithOrgIds[]): ProcessedEvent[] {
  const out: ProcessedEvent[] = [];
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const e of raw) {
    if (!e.startDate) continue;
    const startDate = parseDate(e.startDate);
    if (!startDate) continue;
    const endDate = e.endDate ? parseDate(e.endDate) : null;
    const startHasTime = hasTime(e.startDate);
    const endHasTime = e.endDate ? hasTime(e.endDate) : false;
    const sameDay =
      !endDate ||
      (startDate.getFullYear() === endDate.getFullYear() &&
        startDate.getMonth() === endDate.getMonth() &&
        startDate.getDate() === endDate.getDate());
    const hasEnd = !!endDate && !sameDay;

    let timeLabel = "";
    if (startHasTime) {
      timeLabel = `Début à ${formatTime(startDate)}`;
      if (endDate && endHasTime) {
        if (sameDay) {
          timeLabel += ` — Fin à ${formatTime(endDate)}`;
        } else {
          timeLabel += ` — Fin le ${endDate.getDate()} ${FRENCH_MONTHS[endDate.getMonth()].toLowerCase()} à ${formatTime(endDate)}`;
        }
      }
    }

    const content = (e.content ?? "").trim();
    const shortContent =
      content.length > 200 ? content.slice(0, 200).trim() + "…" : content;
    const monthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;

    out.push({
      id: e.id,
      url: e.url,
      title: e.title ?? "Sans titre",
      content,
      shortContent,
      location: e.location ?? "",
      categories: e.categories ?? [],
      org_ids: e.org_ids ?? [],
      startDate,
      endDate,
      startDay: String(startDate.getDate()).padStart(2, "0"),
      startMonth: FRENCH_MONTHS[startDate.getMonth()],
      endDay: endDate ? String(endDate.getDate()).padStart(2, "0") : "",
      endMonth: endDate ? FRENCH_MONTHS[endDate.getMonth()] : "",
      hasEnd,
      timeLabel,
      monthKey,
      isPast: startDate < currentMonthStart,
    });
  }
  out.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return out;
}

export type ActiveFilter =
  | {
      key: string;
      type: "category";
      label: string;
      color: string;
      bg: string;
      text: string;
      data: string;
    }
  | { key: string; type: "audience"; label: string; data: string }
  | { key: string; type: "org"; label: string; data: string }
  | { key: string; type: "date"; label: string; data: null }
  | { key: string; type: "search"; label: string; data: null };

export const PAGE_SIZE = 20;

export function monthLabel(d: Date): string {
  return `${FRENCH_MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isSameMonthAsNow(d: Date): boolean {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

export function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Filters events — ported as-is from the `visibleEvents` getter. */
export function filterEvents(opts: {
  allEvents: readonly ProcessedEvent[];
  currentDate: Date;
  dateFilter: Date | null;
  selectedCategories: ReadonlySet<string>;
  selectedAudiences: ReadonlySet<string>;
  selectedOrgId: string | null;
  searchQuery: string;
}): ProcessedEvent[] {
  const q = normalize(opts.searchQuery.trim());
  const monthStart = new Date(
    opts.currentDate.getFullYear(),
    opts.currentDate.getMonth(),
    1,
  );
  const monthEnd = new Date(
    opts.currentDate.getFullYear(),
    opts.currentDate.getMonth() + 1,
    0,
    23,
    59,
    59,
  );

  return opts.allEvents.filter((e) => {
    const effectiveEnd = e.endDate ?? e.startDate;
    if (e.startDate > monthEnd) return false;
    if (effectiveEnd < monthStart) return false;

    if (opts.dateFilter) {
      const df = opts.dateFilter;
      const dayStart = new Date(df.getFullYear(), df.getMonth(), df.getDate());
      const dayEnd = new Date(
        df.getFullYear(),
        df.getMonth(),
        df.getDate(),
        23,
        59,
        59,
      );
      const evEnd = e.endDate ?? e.startDate;
      if (e.startDate > dayEnd || evEnd < dayStart) return false;
    }

    if (opts.selectedCategories.size > 0) {
      if (!e.categories.some((c) => opts.selectedCategories.has(c)))
        return false;
    }

    if (opts.selectedAudiences.size > 0) {
      if (!e.categories.some((c) => opts.selectedAudiences.has(c)))
        return false;
    }

    if (opts.selectedOrgId && !e.org_ids.includes(opts.selectedOrgId)) {
      return false;
    }

    if (q) {
      const haystack = [e.title, e.content, e.location, ...e.categories]
        .map(normalize)
        .join(" ");
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

/** Ported as-is from the `filteredOrgs` getter. */
export function filterOrgs(
  allOrgs: readonly OrgSummary[],
  query: string,
): OrgSummary[] {
  const q = normalize(query.trim());
  if (!q) return allOrgs.slice(0, 20);
  return allOrgs.filter((o) => normalize(o.name).includes(q)).slice(0, 20);
}

/** Ported as-is from the `activeFilters` getter, but typed. */
export function buildActiveFilters(opts: {
  selectedCategories: ReadonlySet<string>;
  selectedAudiences: ReadonlySet<string>;
  selectedOrgId: string | null;
  selectedOrgName: string;
  dateFilter: Date | null;
  searchQuery: string;
}): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  for (const catName of opts.selectedCategories) {
    const cat = ALL_CATEGORIES.find((c) => c.name === catName);
    if (cat) {
      out.push({
        key: `cat:${catName}`,
        type: "category",
        label: cat.label,
        color: cat.color,
        bg: cat.bg,
        text: cat.text,
        data: catName,
      });
    }
  }
  for (const audName of opts.selectedAudiences) {
    out.push({
      key: `aud:${audName}`,
      type: "audience",
      label: audName.charAt(0).toUpperCase() + audName.slice(1),
      data: audName,
    });
  }
  if (opts.selectedOrgId) {
    out.push({
      key: `org:${opts.selectedOrgId}`,
      type: "org",
      label: `Org: ${opts.selectedOrgName}`,
      data: opts.selectedOrgId,
    });
  }
  if (opts.dateFilter) {
    const d = opts.dateFilter;
    out.push({
      key: `date:${d.toISOString().slice(0, 10)}`,
      type: "date",
      label: `Date: ${d.getDate()} ${FRENCH_MONTHS_FULL[d.getMonth()].toLowerCase()} ${d.getFullYear()}`,
      data: null,
    });
  }
  if (opts.searchQuery.trim()) {
    out.push({
      key: `search:${opts.searchQuery.trim()}`,
      type: "search",
      label: `« ${opts.searchQuery.trim()} »`,
      data: null,
    });
  }
  return out;
}

export function categoryStyle(catName: string): string {
  const cat = ALL_CATEGORIES.find((c) => c.name === catName);
  if (!cat) return "";
  return `background-color: ${cat.bg}; color: ${cat.text}; border: 1px solid ${cat.color}33;`;
}

/** GET /api/dataEvents (+ ?all=true to include past events). */
export async function fetchEvents(
  includePast: boolean,
): Promise<ProcessedEvent[]> {
  const url = includePast ? "/api/dataEvents?all=true" : "/api/dataEvents";
  const res = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(20000),
  });
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
  const baseData = await res.json();
  return processEvents(baseData.data ?? []);
}

/** GET /api/dataInit, reduced to {id, name} and sorted. */
export async function fetchOrgSummaries(): Promise<OrgSummary[]> {
  const res = await fetch("/api/dataInit", {
    method: "GET",
    signal: AbortSignal.timeout(5000),
  });
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
  const baseData = await res.json();
  const orgs: OrgSummary[] = (baseData.data ?? []).map((o: Org) => ({
    id: o.id,
    name: o.name,
  }));
  orgs.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return orgs;
}
