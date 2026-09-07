import { For, Show } from "solid-js";
import Icon from "../../icons/Icon";
import FilteredOrgList from "./FilteredOrgList";
import { useFilters, useMapSearch } from "./mapSearchContext";
import type { FilterGroup } from "../../../lib/mapSearch/filtersStore";
import filterRaw from "../../../assets/images/filter.svg?raw";
import chatRaw from "../../../assets/images/chat.svg?raw";
import refreshRaw from "../../../assets/images/refresh.svg?raw";
import chevronRaw from "../../../assets/images/chevron-down.svg?raw";
import styles from "./FiltersPanel.module.css";

/** One collapsible chip group (Thématiques / Publics / Localités). */
function FilterGroupBlock(props: {
  group: FilterGroup;
  label: string;
  count: number;
  children: import("solid-js").JSX.Element;
}) {
  const f = useFilters();
  return (
    <div class={styles["filter-group"]}>
      <button
        type="button"
        class={styles["filter-group-header"]}
        onClick={() => f.toggleGroup(props.group)}
      >
        <span class={styles["filter-label"]}>{props.label}</span>
        <Show when={props.count > 0}>
          <span class={styles["filter-count"]}>{props.count}</span>
        </Show>
        <span
          classList={{
            [styles["filter-group-chevron"]]: true,
            [styles.open]: f.isOpen(props.group),
          }}
        >
          <Icon raw={chevronRaw} />
        </span>
      </button>
      <div
        classList={{
          [styles["filter-collapse"]]: true,
          [styles["filter-collapse-open"]]: f.isOpen(props.group),
        }}
      >
        <div class={styles["filter-collapse-inner"]}>
          <div class={styles["chip-row"]}>{props.children}</div>
        </div>
      </div>
    </div>
  );
}

export default function FiltersPanel() {
  const f = useFilters();
  const { shell } = useMapSearch();

  return (
    <div
      classList={{
        [styles.filters]: true,
        none: shell.view() !== "filters",
      }}
    >
      <div class={styles["filters-card"]}>
        <div class={styles["filters-header"]}>
          <div class={styles["filters-header-left"]}>
            <Icon raw={filterRaw} class={styles["filters-svg"]} />
            <h2 class={styles["filters-title"]}>Filtrer</h2>
          </div>
          <button
            type="button"
            class={styles["filters-swap"]}
            title="Poser une question"
            onClick={() => shell.toggleView()}
          >
            <Icon raw={chatRaw} class={styles["filters-swap-ai"]} />
            <span>Poser une question</span>
          </button>
        </div>

        <div class={styles["filter-field"]}>
          <label class={styles["filter-label"]} for="org-search">
            Rechercher
          </label>
          <input
            id="org-search"
            type="text"
            class={styles["filter-search"]}
            placeholder="Nom d'une organisation..."
            value={f.search()}
            onInput={(e) => f.setSearch(e.currentTarget.value)}
          />
        </div>

        <FilterGroupBlock
          group="cat"
          label="Thématiques"
          count={f.selectedCategories().size}
        >
          <For each={f.allCategories}>
            {(cat) => (
              <button
                type="button"
                classList={{
                  [styles.chip]: true,
                  [styles["chip-category"]]: true,
                  [styles["chip-active"]]: f.selectedCategories().has(cat.name),
                }}
                style={{
                  "--chip-color": cat.color,
                  "--chip-bg": cat.bg,
                  "--chip-text": cat.text,
                }}
                onClick={() => f.toggleCategory(cat.name)}
              >
                <span>{cat.label}</span>
              </button>
            )}
          </For>
        </FilterGroupBlock>

        <FilterGroupBlock
          group="aud"
          label="Publics"
          count={f.selectedAudiences().size}
        >
          <For each={f.audiences}>
            {(aud) => (
              <button
                type="button"
                classList={{
                  [styles.chip]: true,
                  [styles["chip-audience"]]: true,
                  [styles["chip-active"]]: f.selectedAudiences().has(aud.name),
                }}
                onClick={() => f.toggleAudience(aud.name)}
              >
                <span>{aud.label}</span>
              </button>
            )}
          </For>
        </FilterGroupBlock>

        <FilterGroupBlock
          group="loc"
          label="Localités"
          count={f.selectedLocations().size + (f.genevaOnly() ? 1 : 0)}
        >
          <button
            type="button"
            classList={{
              [styles.chip]: true,
              [styles["chip-neutral"]]: true,
              [styles["chip-active"]]: f.genevaOnly(),
            }}
            onClick={() => f.toggleGeneva()}
          >
            Tout Genève
          </button>
          <For each={f.allLocations()}>
            {(loc) => (
              <button
                type="button"
                classList={{
                  [styles.chip]: true,
                  [styles["chip-neutral"]]: true,
                  [styles["chip-active"]]: f.selectedLocations().has(loc),
                }}
                onClick={() => f.toggleLocation(loc)}
              >
                <span>{loc}</span>
              </button>
            )}
          </For>
        </FilterGroupBlock>

        <label class={styles["filter-checkbox"]}>
          <input
            type="checkbox"
            checked={f.addressOnly()}
            onChange={(e) => f.setAddressOnly(e.currentTarget.checked)}
          />
          <span>Uniquement avec adresse</span>
        </label>

        <Show when={f.hasActiveFilters()}>
          <div class={styles["filter-field"]}>
            <span class={styles["filter-label"]}>Sélectionnés</span>
            <div class={styles["selected-chips"]}>
              <For each={f.activeFilters()}>
                {(af) => (
                  <button
                    type="button"
                    classList={{
                      [styles.chip]: true,
                      [styles["chip-selected"]]: true,
                      [styles["chip-category"]]: af.type === "category",
                      [styles["chip-audience"]]: af.type === "audience",
                      [styles["chip-neutral"]]:
                        af.type !== "category" && af.type !== "audience",
                    }}
                    style={
                      af.color
                        ? {
                            "--chip-color": af.color,
                            "--chip-bg": af.bg,
                            "--chip-text": af.text,
                          }
                        : undefined
                    }
                    onClick={() => f.removeFilter(af)}
                  >
                    <span>{af.label}</span>
                    <span class={styles["chip-x"]} aria-hidden="true">
                      ×
                    </span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={f.hasActiveFilters()}>
          <button
            type="button"
            class={styles["filters-reset"]}
            onClick={() => f.resetFilters()}
          >
            <Icon raw={refreshRaw} width="16" height="16" />
            <span>Réinitialiser les filtres</span>
          </button>
        </Show>
      </div>

      <FilteredOrgList />
    </div>
  );
}
