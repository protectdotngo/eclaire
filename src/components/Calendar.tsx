import { createMemo, createSignal, onMount } from "solid-js";
import "flatpickr/dist/flatpickr.min.css";
import Hero from "./sections/general/Hero";
import Filters from "./sections/calendar/Filters";
import MonthNav from "./sections/calendar/MonthNav";
import EventList from "./sections/calendar/EventList";
import {
  CalendarContext,
  type CalendarStore,
} from "./sections/calendar/calendarContext";
import { ALL_CATEGORIES, AUDIENCES } from "../lib/taxonomy";
import {
  buildActiveFilters,
  categoryStyle,
  fetchEvents,
  fetchOrgSummaries,
  filterEvents,
  filterOrgs,
  firstOfMonth,
  isSameMonthAsNow,
  monthLabel,
  PAGE_SIZE,
  type ActiveFilter,
} from "../lib/calendarState";
import type { OrgSummary } from "../interfaces/org";
import type { ProcessedEvent } from "../interfaces/calendar";
import styles from "./Calendar.module.css";

export default function Calendar() {
  const [allEvents, setAllEvents] = createSignal<readonly ProcessedEvent[]>([]);
  const [allOrgs, setAllOrgs] = createSignal<readonly OrgSummary[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [loadingPast, setLoadingPast] = createSignal(false);
  const [includePast, setIncludePast] = createSignal(false);
  const [searchQuery, setSearchQueryRaw] = createSignal("");
  const [selectedCategories, setSelectedCategories] = createSignal<
    ReadonlySet<string>
  >(new Set());
  const [selectedAudiences, setSelectedAudiences] = createSignal<
    ReadonlySet<string>
  >(new Set());
  const [selectedOrgId, setSelectedOrgId] = createSignal<string | null>(null);
  const [selectedOrgName, setSelectedOrgName] = createSignal("");
  const [dateFilter, setDateFilter] = createSignal<Date | null>(null);
  // Initialised on the server AND re-initialised in onMount: the container
  // runs in UTC and the client in Europe/Zurich, so around a month boundary at
  // midnight the SSR-rendered label could be the wrong month.
  const [currentDate, setCurrentDate] = createSignal(firstOfMonth(new Date()));
  const [filtersOpen, setFiltersOpen] = createSignal(false);
  const [orgSearchQuery, setOrgSearchQuery] = createSignal("");
  const [orgDropdownOpen, setOrgDropdownOpen] = createSignal(false);
  const [expandedId, setExpandedId] = createSignal<string | null>(null);
  const [visibleCount, setVisibleCount] = createSignal(PAGE_SIZE);

  let flatpickrInstance: { clear(): void } | null = null;

  /** Every filtering action collapses the detail and returns to page 1. */
  const resetPaging = () => {
    setExpandedId(null);
    setVisibleCount(PAGE_SIZE);
  };

  const visibleEvents = createMemo(() =>
    filterEvents({
      allEvents: allEvents(),
      currentDate: currentDate(),
      dateFilter: dateFilter(),
      selectedCategories: selectedCategories(),
      selectedAudiences: selectedAudiences(),
      selectedOrgId: selectedOrgId(),
      searchQuery: searchQuery(),
    }),
  );

  const store: CalendarStore = {
    allOrgs,
    loading,
    loadingPast,
    includePast,
    searchQuery,
    setSearchQuery(v) {
      setSearchQueryRaw(v);
      // Was a $watch("searchQuery") that reset visibleCount to pageSize.
      setVisibleCount(PAGE_SIZE);
    },
    selectedCategories,
    selectedAudiences,
    selectedOrgId,
    dateFilter,
    currentDate,
    filtersOpen,
    setFiltersOpen,
    orgSearchQuery,
    setOrgSearchQuery,
    orgDropdownOpen,
    setOrgDropdownOpen,
    expandedId,

    allCategories: ALL_CATEGORIES,
    audiences: AUDIENCES,

    currentMonthLabel: createMemo(() => monthLabel(currentDate())),
    visibleEvents,
    pagedEvents: createMemo(() => visibleEvents().slice(0, visibleCount())),
    remainingCount: createMemo(() =>
      Math.max(0, visibleEvents().length - visibleCount()),
    ),
    filteredOrgs: createMemo(() => filterOrgs(allOrgs(), orgSearchQuery())),
    activeFilters: createMemo(() =>
      buildActiveFilters({
        selectedCategories: selectedCategories(),
        selectedAudiences: selectedAudiences(),
        selectedOrgId: selectedOrgId(),
        selectedOrgName: selectedOrgName(),
        dateFilter: dateFilter(),
        searchQuery: searchQuery(),
      }),
    ),
    isCurrentMonth: createMemo(() => isSameMonthAsNow(currentDate())),

    async setIncludePastAndReload(v) {
      setIncludePast(v);
      setLoadingPast(true);
      resetPaging();
      try {
        setAllEvents(await fetchEvents(v));
      } catch (err) {
        console.error("Failed to load events:", err);
        setAllEvents([]);
      }
      setLoadingPast(false);
    },

    setDateFromPicker(picked) {
      setDateFilter(picked);
      if (picked) {
        setCurrentDate(firstOfMonth(picked));
        resetPaging();
      }
    },

    registerFlatpickr(fp) {
      flatpickrInstance = fp;
    },

    prevMonth() {
      if (!includePast() && isSameMonthAsNow(currentDate())) return;
      const d = currentDate();
      setCurrentDate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
      resetPaging();
    },

    nextMonth() {
      const d = currentDate();
      setCurrentDate(new Date(d.getFullYear(), d.getMonth() + 1, 1));
      resetPaging();
    },

    goToToday() {
      setCurrentDate(firstOfMonth(new Date()));
      resetPaging();
    },

    toggleCategory(name) {
      setSelectedCategories((prev) => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
      resetPaging();
    },

    toggleAudience(name) {
      setSelectedAudiences((prev) => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
      resetPaging();
    },

    selectOrg(org) {
      setSelectedOrgId(org.id);
      setSelectedOrgName(org.name);
      resetPaging();
    },

    removeFilter(f: ActiveFilter) {
      if (f.type === "category") {
        setSelectedCategories((prev) => {
          const next = new Set(prev);
          next.delete(f.data);
          return next;
        });
      } else if (f.type === "audience") {
        setSelectedAudiences((prev) => {
          const next = new Set(prev);
          next.delete(f.data);
          return next;
        });
      } else if (f.type === "org") {
        setSelectedOrgId(null);
        setSelectedOrgName("");
      } else if (f.type === "date") {
        setDateFilter(null);
        flatpickrInstance?.clear();
      } else if (f.type === "search") {
        setSearchQueryRaw("");
      }
      resetPaging();
    },

    loadMore() {
      setVisibleCount((n) => n + PAGE_SIZE);
    },

    toggleExpand(id) {
      setExpandedId((prev) => (prev === id ? null : id));
    },

    getCategoryStyle: categoryStyle,
  };

  onMount(async () => {
    setCurrentDate(firstOfMonth(new Date()));

    const urlOrgId = new URLSearchParams(window.location.search).get("org");

    const [events, orgs] = await Promise.all([
      fetchEvents(includePast()).catch((err) => {
        console.error("Failed to load events:", err);
        return [] as ProcessedEvent[];
      }),
      fetchOrgSummaries().catch((err) => {
        console.error("Failed to load orgs:", err);
        return [] as OrgSummary[];
      }),
    ]);
    setAllEvents(events);
    setAllOrgs(orgs);

    if (urlOrgId) {
      const found = orgs.find((o) => o.id === urlOrgId);
      if (found) {
        setSelectedOrgId(found.id);
        setSelectedOrgName(found.name);
      }
    }

    setLoading(false);
  });

  return (
    <CalendarContext.Provider value={store}>
      <section>
        <Hero
          title="Calendrier"
          lead="Éclaire, le phare numérique, fédère plusieurs événements organisés par des associations numériques et autres partenaires de la ville, à différents endroits de Genève et ses environs."
          body="Ces rendez-vous, qui se tiennent dans des lieux variés et fréquentés permettent de répondre aux questions du public sur la technologie au quotidien: usage du smartphone, de l'ordinateur ou des réseaux sociaux, protection des données, prévention des arnaques en ligne ou encore cybersécurité. Organisés à plusieurs reprises entre avril et juin 2026, ces événements permettent de démystifier le numérique auprès d'un large public, des seniors aux jeunes, et de rendre la technologie plus accessible et moins intimidante pour toutes et tous."
          image="/images/3.jpg"
          comp
        >
          <Filters />
        </Hero>
        <div class={styles["calendar-page"]}>
          <MonthNav />
          <EventList />
        </div>
      </section>
    </CalendarContext.Provider>
  );
}
