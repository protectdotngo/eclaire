import flatpickr from "flatpickr";
import { French } from "flatpickr/dist/l10n/fr.js";
import { DISPLAY_BUCKETS } from "../data/calendarConfig";
import { AUDIENCE_TAGS } from "../data/audienceTags";
import type {
  Org,
  EventWithOrgIds,
  ProcessedEvent,
  OrgSummary,
} from "../interfaces";

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

export function createCalendarComponent() {
  return {
    allEvents: [] as ProcessedEvent[],
    allOrgs: [] as OrgSummary[],
    loading: true,
    includePast: false,
    loadingPast: false,
    searchQuery: "",
    selectedCategories: new Set<string>(),
    selectedAudiences: new Set<string>(),
    selectedOrgId: null as string | null,
    selectedOrgName: "",
    dateFilter: null as Date | null,
    currentDate: new Date(),
    filtersOpen: false,
    orgSearchQuery: "",
    orgDropdownOpen: false,
    expandedId: null as string | null,
    allCategories: ALL_CATEGORIES,
    audiences: AUDIENCES,
    flatpickrInstance: null as flatpickr.Instance | null,

    $nextTick: undefined as unknown as (callback: () => void) => void,

    async init() {
      this.currentDate = new Date(
        this.currentDate.getFullYear(),
        this.currentDate.getMonth(),
        1,
      );

      const urlParams = new URLSearchParams(window.location.search);
      const urlOrgId = urlParams.get("org");

      await Promise.all([this.fetchEvents(), this.fetchOrgs()]);

      if (urlOrgId) {
        const found = this.allOrgs.find((o) => o.id === urlOrgId);
        if (found) {
          this.selectedOrgId = found.id;
          this.selectedOrgName = found.name;
        }
      }

      this.loading = false;
      this.$nextTick(() => this.initDatePicker());
    },

    async fetchEvents() {
      try {
        const url = this.includePast
          ? "/api/dataEvents?all=true"
          : "/api/dataEvents";
        const res = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(20000),
        });
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        const baseData = await res.json();
        this.allEvents = processEvents(baseData.data ?? []);
      } catch (err) {
        console.error("Failed to load events:", err);
        this.allEvents = [];
      }
    },

    async onIncludePastChange() {
      this.loadingPast = true;
      this.expandedId = null;
      await this.fetchEvents();
      this.loadingPast = false;
    },

    async fetchOrgs() {
      try {
        const res = await fetch("/api/dataInit", {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        const baseData = await res.json();
        this.allOrgs = (baseData.data ?? []).map((o: Org) => ({
          id: o.id,
          name: o.name,
        }));
        this.allOrgs.sort((a, b) => a.name.localeCompare(b.name, "fr"));
      } catch (err) {
        console.error("Failed to load orgs:", err);
        this.allOrgs = [];
      }
    },

    initDatePicker() {
      const el = document.getElementById("date-picker-input");
      if (!el) return;
      this.flatpickrInstance = flatpickr(el as HTMLInputElement, {
        locale: French,
        dateFormat: "d M Y",
        allowInput: false,
        disableMobile: true,
        onChange: (dates: Date[]) => {
          const picked = dates[0] ?? null;
          this.dateFilter = picked;
          if (picked) {
            this.currentDate = new Date(
              picked.getFullYear(),
              picked.getMonth(),
              1,
            );
            this.expandedId = null;
          }
        },
      });
    },

    get currentMonthLabel(): string {
      return `${FRENCH_MONTHS_FULL[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
    },

    get currentMonthKey(): string {
      return `${this.currentDate.getFullYear()}-${String(this.currentDate.getMonth() + 1).padStart(2, "0")}`;
    },

    get visibleEvents(): ProcessedEvent[] {
      const q = normalize(this.searchQuery.trim());
      const monthStart = new Date(
        this.currentDate.getFullYear(),
        this.currentDate.getMonth(),
        1,
      );
      const monthEnd = new Date(
        this.currentDate.getFullYear(),
        this.currentDate.getMonth() + 1,
        0,
        23,
        59,
        59,
      );

      return this.allEvents.filter((e) => {
        const effectiveEnd = e.endDate ?? e.startDate;
        if (e.startDate > monthEnd) return false;
        if (effectiveEnd < monthStart) return false;

        if (this.dateFilter) {
          const df = this.dateFilter;
          const dayStart = new Date(
            df.getFullYear(),
            df.getMonth(),
            df.getDate(),
          );
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

        if (this.selectedCategories.size > 0) {
          const hasMatch = e.categories.some((c) =>
            this.selectedCategories.has(c),
          );
          if (!hasMatch) return false;
        }

        if (this.selectedAudiences.size > 0) {
          const hasMatch = e.categories.some((c) =>
            this.selectedAudiences.has(c),
          );
          if (!hasMatch) return false;
        }

        if (this.selectedOrgId) {
          if (!e.org_ids.includes(this.selectedOrgId)) return false;
        }

        if (q) {
          const haystack = [e.title, e.content, e.location, ...e.categories]
            .map(normalize)
            .join(" ");
          if (!haystack.includes(q)) return false;
        }

        return true;
      });
    },

    get filteredOrgs(): OrgSummary[] {
      const q = normalize(this.orgSearchQuery.trim());
      if (!q) return this.allOrgs.slice(0, 20);
      return this.allOrgs
        .filter((o) => normalize(o.name).includes(q))
        .slice(0, 20);
    },

    get activeFilters() {
      const out: any[] = [];
      for (const catName of this.selectedCategories) {
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
      for (const audName of this.selectedAudiences) {
        out.push({
          key: `aud:${audName}`,
          type: "audience",
          label: audName.charAt(0).toUpperCase() + audName.slice(1),
          data: audName,
        });
      }
      if (this.selectedOrgId) {
        out.push({
          key: `org:${this.selectedOrgId}`,
          type: "org",
          label: `Org: ${this.selectedOrgName}`,
          data: this.selectedOrgId,
        });
      }
      if (this.dateFilter) {
        const d = this.dateFilter;
        out.push({
          key: `date:${d.toISOString().slice(0, 10)}`,
          type: "date",
          label: `Date: ${d.getDate()} ${FRENCH_MONTHS_FULL[d.getMonth()].toLowerCase()} ${d.getFullYear()}`,
          data: null,
        });
      }
      if (this.searchQuery.trim()) {
        out.push({
          key: `search:${this.searchQuery.trim()}`,
          type: "search",
          label: `« ${this.searchQuery.trim()} »`,
          data: null,
        });
      }
      return out;
    },

    get isCurrentMonth(): boolean {
      const now = new Date();
      return (
        this.currentDate.getFullYear() === now.getFullYear() &&
        this.currentDate.getMonth() === now.getMonth()
      );
    },

    goToToday() {
      const now = new Date();
      this.currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
      this.expandedId = null;
    },

    toggleCategory(name: string) {
      if (this.selectedCategories.has(name)) {
        this.selectedCategories.delete(name);
      } else {
        this.selectedCategories.add(name);
      }
      this.selectedCategories = new Set(this.selectedCategories);
      this.expandedId = null;
    },

    toggleAudience(name: string) {
      if (this.selectedAudiences.has(name)) {
        this.selectedAudiences.delete(name);
      } else {
        this.selectedAudiences.add(name);
      }
      this.selectedAudiences = new Set(this.selectedAudiences);
      this.expandedId = null;
    },

    selectOrg(org: OrgSummary) {
      this.selectedOrgId = org.id;
      this.selectedOrgName = org.name;
      this.expandedId = null;
    },

    removeFilter(f: any) {
      if (f.type === "category") {
        this.selectedCategories.delete(f.data);
        this.selectedCategories = new Set(this.selectedCategories);
      } else if (f.type === "audience") {
        this.selectedAudiences.delete(f.data);
        this.selectedAudiences = new Set(this.selectedAudiences);
      } else if (f.type === "org") {
        this.selectedOrgId = null;
        this.selectedOrgName = "";
      } else if (f.type === "date") {
        this.dateFilter = null;
        this.flatpickrInstance?.clear();
      } else if (f.type === "search") {
        this.searchQuery = "";
      }
      this.expandedId = null;
    },

    prevMonth() {
      if (!this.includePast && this.isCurrentMonth) return;
      this.currentDate = new Date(
        this.currentDate.getFullYear(),
        this.currentDate.getMonth() - 1,
        1,
      );
      this.expandedId = null;
    },

    nextMonth() {
      this.currentDate = new Date(
        this.currentDate.getFullYear(),
        this.currentDate.getMonth() + 1,
        1,
      );
      this.expandedId = null;
    },

    toggleExpand(id: string) {
      this.expandedId = this.expandedId === id ? null : id;
    },

    getCategoryStyle(catName: string): string {
      const cat = ALL_CATEGORIES.find((c) => c.name === catName);
      if (!cat) return "";
      return `background-color: ${cat.bg}; color: ${cat.text}; border: 1px solid ${cat.color}33;`;
    },
  };
}
