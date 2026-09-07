import { Show } from "solid-js";
import Icon from "../../icons/Icon";
import { useMapSearch } from "./mapSearchContext";
import filterRaw from "../../../assets/images/filter.svg?raw";
import crossRaw from "../../../assets/images/cross.svg?raw";
import refreshRaw from "../../../assets/images/refresh.svg?raw";
import enterRaw from "../../../assets/images/corner-down-left.svg?raw";
import styles from "./SearchBar.module.css";

export default function SearchBar() {
  const { chat, shell } = useMapSearch();

  const submit = () => {
    const text = shell.query().trim();
    if (!text || shell.thinking()) return;
    shell.setQuery("");
    void chat.send(text);
  };

  return (
    <div
      classList={{
        [styles.search]: true,
        none: shell.view() !== "chat",
      }}
    >
      <div class={styles["search-bar-filters"]}>
        <form
          class="ai-search"
          onSubmit={(e) => e.preventDefault()}
          // Replaces the inline onkeydown attribute that reached for
          // document.getElementById('aiFormSubmit').
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        >
          <div class={styles["ai-search-cont"]}>
            <input
              type="text"
              class={styles["ai-search-bar"]}
              name="search"
              placeholder="Posez nous une question !"
              value={shell.query()}
              onInput={(e) => shell.setQuery(e.currentTarget.value)}
            />
            <Show when={shell.query() !== ""}>
              <Icon
                raw={crossRaw}
                id="clear-search"
                onClick={() => shell.setQuery("")}
              />
            </Show>
            <button
              type="button"
              class={styles["ai-search-btn"]}
              disabled={shell.thinking()}
              onClick={submit}
            >
              <span>Envoyer</span>
              <Icon raw={enterRaw} width="18" height="18" />
            </button>
          </div>
        </form>

        <div class={styles["ai-actions"]}>
          <Show when={shell.showReset()}>
            <button
              type="button"
              class={styles["ai-reset-btn"]}
              onClick={() => chat.reset()}
            >
              <Icon raw={refreshRaw} width="16" height="16" /> Nouvelle
              recherche
            </button>
          </Show>
          <button class={styles["ai-swap"]} onClick={() => shell.toggleView()}>
            <Icon raw={filterRaw} width="18" height="22" />
            <span class={styles["ai-swap-link"]}>Recherche par critères</span>
          </button>
        </div>
      </div>
    </div>
  );
}
