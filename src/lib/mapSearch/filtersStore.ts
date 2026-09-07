import { createMemo, createSignal } from "solid-js";
import type { Accessor } from "solid-js";
import { $mapData } from "../mapStore";
import { ALL_CATEGORIES, AUDIENCES } from "../taxonomy";
import type { OrgWithChatContext } from "../../interfaces/org";

export type FilterKind =
  | "category"
  | "audience"
  | "location"
  | "geneva"
  | "address";

export interface ActiveFilter {
  type: FilterKind;
  value: string;
  label: string;
  color?: string;
  bg?: string;
  text?: string;
}

export type FilterGroup = "cat" | "aud" | "loc";

export interface FiltersStore {
  allCategories: typeof ALL_CATEGORIES;
  audiences: typeof AUDIENCES;
  allLocations: Accessor<readonly string[]>;
  setAllLocations(v: readonly string[]): void;
  setAllOrgs(v: readonly OrgWithChatContext[]): void;

  selectedCategories: Accessor<ReadonlySet<string>>;
  selectedAudiences: Accessor<ReadonlySet<string>>;
  selectedLocations: Accessor<ReadonlySet<string>>;
  genevaOnly: Accessor<boolean>;
  addressOnly: Accessor<boolean>;
  setAddressOnly(v: boolean): void;
  search: Accessor<string>;
  setSearch(v: string): void;

  isOpen(group: FilterGroup): boolean;
  toggleGroup(group: FilterGroup): void;

  toggleCategory(name: string): void;
  toggleAudience(name: string): void;
  toggleLocation(name: string): void;
  toggleGeneva(): void;
  removeFilter(f: Pick<ActiveFilter, "type" | "value">): void;
  resetFilters(): void;

  hasActiveFilters: Accessor<boolean>;
  activeFilters: Accessor<readonly ActiveFilter[]>;

  /** Filters, sorts by name (fr) and writes to $mapData. */
  apply(): void;
}

export function createFiltersStore(): FiltersStore {
  const [allOrgs, setAllOrgsSignal] = createSignal<
    readonly OrgWithChatContext[]
  >([]);
  const [allLocations, setAllLocations] = createSignal<readonly string[]>([]);
  // Sets replaced on write: a mutated Set is no more reactive in Solid than
  // in Alpine, but this time the type says so.
  const [selectedCategories, setSelectedCategories] = createSignal<
    ReadonlySet<string>
  >(new Set());
  const [selectedAudiences, setSelectedAudiences] = createSignal<
    ReadonlySet<string>
  >(new Set());
  const [selectedLocations, setSelectedLocations] = createSignal<
    ReadonlySet<string>
  >(new Set());
  const [genevaOnly, setGenevaOnly] = createSignal(false);
  const [addressOnly, setAddressOnlySignal] = createSignal(false);
  const [search, setSearchSignal] = createSignal("");
  const [openGroups, setOpenGroups] = createSignal<ReadonlySet<FilterGroup>>(
    new Set(),
  );

  const store: FiltersStore = {
    allCategories: ALL_CATEGORIES,
    audiences: AUDIENCES,
    allLocations,
    setAllLocations,

    setAllOrgs(v) {
      setAllOrgsSignal(v);
      store.apply();
    },

    selectedCategories,
    selectedAudiences,
    selectedLocations,
    genevaOnly,
    addressOnly,
    setAddressOnly(v) {
      setAddressOnlySignal(v);
      store.apply();
    },
    search,
    setSearch(v) {
      setSearchSignal(v);
      store.apply();
    },

    isOpen: (group) => openGroups().has(group),
    toggleGroup(group) {
      setOpenGroups((prev) => {
        const next = new Set(prev);
        next.has(group) ? next.delete(group) : next.add(group);
        return next;
      });
    },

    toggleCategory(name) {
      setSelectedCategories((prev) => toggled(prev, name));
      store.apply();
    },
    toggleAudience(name) {
      setSelectedAudiences((prev) => toggled(prev, name));
      store.apply();
    },
    toggleLocation(name) {
      setSelectedLocations((prev) => toggled(prev, name));
      store.apply();
    },
    toggleGeneva() {
      setGenevaOnly((v) => !v);
      store.apply();
    },

    removeFilter(f) {
      if (f.type === "category") {
        setSelectedCategories((prev) => without(prev, f.value));
      } else if (f.type === "audience") {
        setSelectedAudiences((prev) => without(prev, f.value));
      } else if (f.type === "location") {
        setSelectedLocations((prev) => without(prev, f.value));
      } else if (f.type === "geneva") {
        setGenevaOnly(false);
      } else if (f.type === "address") {
        setAddressOnlySignal(false);
      }
      store.apply();
    },

    resetFilters() {
      setSelectedCategories(new Set<string>());
      setSelectedAudiences(new Set<string>());
      setSelectedLocations(new Set<string>());
      setGenevaOnly(false);
      setAddressOnlySignal(false);
      setSearchSignal("");
      store.apply();
    },

    hasActiveFilters: createMemo(
      () =>
        selectedCategories().size > 0 ||
        selectedAudiences().size > 0 ||
        selectedLocations().size > 0 ||
        genevaOnly() ||
        addressOnly() ||
        search().trim() !== "",
    ),

    activeFilters: createMemo<readonly ActiveFilter[]>(() => {
      const out: ActiveFilter[] = [];
      selectedCategories().forEach((c) => {
        const cat = ALL_CATEGORIES.find((x) => x.name === c);
        out.push({
          type: "category",
          value: c,
          label: cat?.label ?? c,
          color: cat?.color,
          bg: cat?.bg,
          text: cat?.text,
        });
      });
      selectedAudiences().forEach((a) => {
        const aud = AUDIENCES.find((x) => x.name === a);
        out.push({ type: "audience", value: a, label: aud?.label ?? a });
      });
      selectedLocations().forEach((l) =>
        out.push({ type: "location", value: l, label: l }),
      );
      if (genevaOnly()) {
        out.push({ type: "geneva", value: "", label: "Tout Genève" });
      }
      if (addressOnly()) {
        out.push({ type: "address", value: "", label: "Avec adresse" });
      }
      return out;
    }),

    apply() {
      const cats = selectedCategories();
      const auds = selectedAudiences();
      const locs = selectedLocations();
      const q = search().trim().toLowerCase();
      const onlyGeneva = genevaOnly();
      const onlyAddress = addressOnly();

      const result = allOrgs()
        .filter((org) => {
          const matchCat =
            cats.size === 0 ||
            org.categories.some((c) => cats.has(c.toLowerCase()));
          const matchAud =
            auds.size === 0 ||
            org.categories.some((c) => auds.has(c.toLowerCase()));
          const matchLoc = locs.size === 0 || locs.has(org.city);
          const matchGeneva =
            !onlyGeneva ||
            (org.city ?? "").toLowerCase().includes("genève") ||
            (org.city ?? "").toLowerCase().includes("geneve");
          const matchAddress = !onlyAddress || !!org.address?.trim();
          const matchSearch =
            q === "" ||
            org.name.toLowerCase().includes(q) ||
            (org.desc ?? "").toLowerCase().includes(q) ||
            (org.address ?? "").toLowerCase().includes(q) ||
            (org.city ?? "").toLowerCase().includes(q);
          return (
            matchCat &&
            matchAud &&
            matchLoc &&
            matchGeneva &&
            matchAddress &&
            matchSearch
          );
        })
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));

      $mapData.set(result);
    },
  };

  return store;
}

function toggled(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
  const next = new Set(set);
  next.has(value) ? next.delete(value) : next.add(value);
  return next;
}

function without(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
  const next = new Set(set);
  next.delete(value);
  return next;
}
