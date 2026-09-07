import Icon from "../../icons/Icon";
import { useCalendar } from "./calendarContext";
import searchRaw from "../../../assets/images/search.svg?raw";
import chevronDownRaw from "../../../assets/images/chevron-down.svg?raw";
import styles from "./FilterBar.module.css";

export default function FilterBar() {
  const cal = useCalendar();
  return (
    <div class={styles["filter-bar"]}>
      <div class={styles["search-wrap"]}>
        <Icon raw={searchRaw} class={styles["search-icon"]} />
        <input
          type="search"
          class={styles["search-input"]}
          placeholder="Rechercher un événement..."
          value={cal.searchQuery()}
          onInput={(e) => cal.setSearchQuery(e.currentTarget.value)}
        />
      </div>

      <button
        type="button"
        classList={{
          [styles["filter-toggle"]]: true,
          [styles["filter-toggle-open"]]: cal.filtersOpen(),
        }}
        onClick={() => cal.setFiltersOpen(!cal.filtersOpen())}
        aria-expanded={cal.filtersOpen()}
      >
        <span>Filtres</span>
        <Icon raw={chevronDownRaw} class={styles.chevron} />
      </button>
    </div>
  );
}
