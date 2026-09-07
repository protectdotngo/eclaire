import { createContext, useContext } from "solid-js";
import type { Accessor } from "solid-js";
import type { OrgSummary } from "../../../interfaces/org";
import type { ProcessedEvent } from "../../../interfaces/calendar";
import type { ActiveFilter } from "../../../lib/calendarState";
import type { ALL_CATEGORIES, AUDIENCES } from "../../../lib/taxonomy";

export interface CalendarStore {
  // etat
  allOrgs: Accessor<readonly OrgSummary[]>;
  loading: Accessor<boolean>;
  loadingPast: Accessor<boolean>;
  includePast: Accessor<boolean>;
  searchQuery: Accessor<string>;
  setSearchQuery(v: string): void;
  selectedCategories: Accessor<ReadonlySet<string>>;
  selectedAudiences: Accessor<ReadonlySet<string>>;
  selectedOrgId: Accessor<string | null>;
  dateFilter: Accessor<Date | null>;
  currentDate: Accessor<Date>;
  filtersOpen: Accessor<boolean>;
  setFiltersOpen(v: boolean): void;
  orgSearchQuery: Accessor<string>;
  setOrgSearchQuery(v: string): void;
  orgDropdownOpen: Accessor<boolean>;
  setOrgDropdownOpen(v: boolean): void;
  expandedId: Accessor<string | null>;

  // taxonomie statique (non reactive)
  allCategories: typeof ALL_CATEGORIES;
  audiences: typeof AUDIENCES;

  // derive (createMemo) — etaient des getters Alpine
  currentMonthLabel: Accessor<string>;
  visibleEvents: Accessor<readonly ProcessedEvent[]>;
  pagedEvents: Accessor<readonly ProcessedEvent[]>;
  remainingCount: Accessor<number>;
  filteredOrgs: Accessor<readonly OrgSummary[]>;
  activeFilters: Accessor<readonly ActiveFilter[]>;
  isCurrentMonth: Accessor<boolean>;

  // actions
  setIncludePastAndReload(v: boolean): Promise<void>;
  setDateFromPicker(d: Date | null): void;
  registerFlatpickr(fp: { clear(): void } | null): void;
  prevMonth(): void;
  nextMonth(): void;
  goToToday(): void;
  toggleCategory(name: string): void;
  toggleAudience(name: string): void;
  selectOrg(org: OrgSummary): void;
  removeFilter(f: ActiveFilter): void;
  loadMore(): void;
  toggleExpand(id: string): void;
  getCategoryStyle(catName: string): string;
}

export const CalendarContext = createContext<CalendarStore>();

export function useCalendar(): CalendarStore {
  const ctx = useContext(CalendarContext);
  if (!ctx) {
    throw new Error("useCalendar() doit etre appele dans <Calendar>");
  }
  return ctx;
}
