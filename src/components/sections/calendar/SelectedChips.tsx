import { For, Show } from "solid-js";
import { useCalendar } from "./calendarContext";
import styles from "./SelectedChips.module.css";

export default function SelectedChips() {
  const cal = useCalendar();
  return (
    <>
      <div class={styles["filter-section-label"]}>Sélectionnés</div>
      <div class={styles["selected-chips"]}>
        <For each={cal.activeFilters()}>
          {(f) => (
            <button
              type="button"
              classList={{
                [styles.chip]: true,
                [styles["chip-selected"]]: true,
                [styles["chip-category"]]: f.type === "category",
                [styles["chip-audience"]]: f.type === "audience",
                [styles["chip-neutral"]]:
                  f.type !== "category" && f.type !== "audience",
              }}
              style={
                f.type === "category"
                  ? {
                      "--chip-color": f.color,
                      "--chip-bg": f.bg,
                      "--chip-text": f.text,
                    }
                  : undefined
              }
              onClick={() => cal.removeFilter(f)}
            >
              <span>{f.label}</span>
              <span class={styles["chip-x"]} aria-hidden="true">
                ×
              </span>
            </button>
          )}
        </For>
        <Show when={cal.activeFilters().length === 0}>
          <span class={styles["selected-empty"]}>Aucun filtre actif</span>
        </Show>
      </div>
    </>
  );
}
