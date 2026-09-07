import { createContext, useContext } from "solid-js";
import type { Accessor } from "solid-js";
import type { TimelineStore } from "../../../lib/mapSearch/timelineStore";
import type { FiltersStore } from "../../../lib/mapSearch/filtersStore";
import type { ChatController } from "../../../lib/mapSearch/chatController";

/**
 * View state that used to be classList.toggle("none") calls against hard-coded
 * element ids (#aiInfo, #aiReset, #search-bar, #clear-search) plus the `.swap`
 * buttons toggling #filters / #map-search-ai / #search / #quickQuestions.
 */
export interface MapSearchShell {
  view: Accessor<"chat" | "filters">;
  toggleView(): void;
  showInfo: Accessor<boolean>;
  setShowInfo(v: boolean): void;
  showReset: Accessor<boolean>;
  setShowReset(v: boolean): void;
  query: Accessor<string>;
  setQuery(v: string): void;
  /** Single source of truth: mirrors timeline.thinking. */
  thinking: Accessor<boolean>;
}

export interface MapSearchContextValue {
  timeline: TimelineStore;
  chat: ChatController;
  shell: MapSearchShell;
}

export const MapSearchContext = createContext<MapSearchContextValue>();

export function useMapSearch(): MapSearchContextValue {
  const ctx = useContext(MapSearchContext);
  if (!ctx) {
    throw new Error("useMapSearch() must be called inside <MapSearchIsland>");
  }
  return ctx;
}

export const FiltersContext = createContext<FiltersStore>();

export function useFilters(): FiltersStore {
  const ctx = useContext(FiltersContext);
  if (!ctx) {
    throw new Error("useFilters() must be called inside <MapSearchIsland>");
  }
  return ctx;
}
