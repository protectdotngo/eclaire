import { createMemo, createSignal, onMount } from "solid-js";
import type { JSX } from "solid-js";
import ConversationTimeline from "./ConversationTimeline";
import QuickQuestions from "./QuickQuestions";
import SearchBar from "./SearchBar";
import FiltersPanel from "./FiltersPanel";
import {
  FiltersContext,
  MapSearchContext,
  type MapSearchShell,
} from "./mapSearchContext";
import { createTimelineStore } from "../../../lib/mapSearch/timelineStore";
import { createFiltersStore } from "../../../lib/mapSearch/filtersStore";
import { createChatController } from "../../../lib/mapSearch/chatController";
import styles from "./mapSearch.module.css";

interface MapSearchIslandProps {
  /** AiInfoSearch, still rendered by Astro and passed in as a slot. */
  children?: JSX.Element;
}

export default function MapSearchIsland(props: MapSearchIslandProps) {
  const [view, setView] = createSignal<"chat" | "filters">("chat");
  const [showInfo, setShowInfo] = createSignal(true);
  const [showReset, setShowReset] = createSignal(false);
  const [query, setQuery] = createSignal("");

  // Plain factories rather than components, so the island root can build them
  // in dependency order and there is no provider-nesting problem.
  const timeline = createTimelineStore();
  const filters = createFiltersStore();

  const shell: MapSearchShell = {
    view,
    toggleView: () => setView((v) => (v === "chat" ? "filters" : "chat")),
    showInfo,
    setShowInfo,
    showReset,
    setShowReset,
    query,
    setQuery,
    thinking: createMemo(() => timeline.thinking()),
  };

  const chat = createChatController({ timeline, filters, shell });

  onMount(() => {
    void chat.loadInitialData();
  });

  return (
    <MapSearchContext.Provider value={{ timeline, chat, shell }}>
      <FiltersContext.Provider value={filters}>
        {/*
          `map-search` is a deliberately UNHASHED marker class: SidePanel.astro
          reaches in with `.side-bar.collapsed :global(.map-search)` to hide the
          panel when the map is focused on mobile, and CSS Modules would
          otherwise rename it out from under that selector.
        */}
        <section class={`map-search ${styles["map-search"]}`}>
          <div
            classList={{
              [styles.ai]: true,
              none: view() !== "chat",
            }}
          >
            <div
              class={styles["ai-response-cont"]}
              // Replaces getElementById("ai-response-cont") in scrollToBottom.
              ref={(el) => timeline.setScrollContainer(el)}
            >
              {/*
                The Astro-rendered AiInfoSearch. It is never unmounted — only a
                `none` class is toggled on its wrapper, byte-for-byte what
                mapSearchController did with aiInfo.classList.
              */}
              <div classList={{ none: !showInfo() }}>{props.children}</div>
              <ConversationTimeline />
            </div>
          </div>

          <div class={styles["search-section"]}>
            <QuickQuestions />
            <SearchBar />
          </div>

          <FiltersPanel />
        </section>
      </FiltersContext.Provider>
    </MapSearchContext.Provider>
  );
}
