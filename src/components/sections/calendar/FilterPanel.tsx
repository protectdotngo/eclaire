import { For, onCleanup, onMount, Show } from "solid-js";
import flatpickr from "flatpickr";
import { French } from "flatpickr/dist/l10n/fr.js";
import Icon from "../../icons/Icon";
import { useCalendar } from "./calendarContext";
import hourglassRaw from "../../../assets/images/hourglass-empty.svg?raw";
import styles from "./FilterPanel.module.css";

export default function FilterPanel() {
  const cal = useCalendar();
  let dateInput!: HTMLInputElement;
  let orgField!: HTMLDivElement;

  onMount(() => {
    // flatpickr est imperatif : il vit dans onMount, et non plus dans l'etat
    // partage via getElementById("date-picker-input").
    const fp = flatpickr(dateInput, {
      locale: French,
      dateFormat: "d M Y",
      allowInput: false,
      disableMobile: true,
      onChange: (dates: Date[]) => cal.setDateFromPicker(dates[0] ?? null),
    });
    cal.registerFlatpickr(fp);
    onCleanup(() => {
      cal.registerFlatpickr(null);
      // Sans ça, un rechargement à chaud laisse des .flatpickr-calendar
      // orphelines accrochées au <body>.
      fp.destroy();
    });

    // Remplace @click.outside
    const onDocClick = (e: MouseEvent) => {
      if (!orgField.contains(e.target as Node)) cal.setOrgDropdownOpen(false);
    };
    document.addEventListener("click", onDocClick);
    onCleanup(() => document.removeEventListener("click", onDocClick));
  });

  return (
    <div
      classList={{
        [styles["filter-section"]]: true,
        [styles["filter-section-open"]]: cal.filtersOpen(),
      }}
    >
      <div class={styles["filter-section-inner"]}>
        <div class={styles["filter-row-controls"]}>
          <div class={styles["filter-control-field"]}>
            <label
              class={styles["filter-control-label"]}
              for="date-picker-input"
            >
              Date
            </label>
            <input
              id="date-picker-input"
              ref={dateInput}
              type="text"
              class={styles["filter-control-input"]}
              placeholder="Choisir une date"
              readonly
            />
          </div>

          <div class={styles["filter-control-field"]} ref={orgField}>
            <label
              class={styles["filter-control-label"]}
              for="org-picker-input"
            >
              Organisation
            </label>
            <div class={styles["org-typeahead"]}>
              <input
                id="org-picker-input"
                type="text"
                class={styles["filter-control-input"]}
                placeholder="Choisir une organisation"
                value={cal.orgSearchQuery()}
                onFocus={() => cal.setOrgDropdownOpen(true)}
                onInput={(e) => {
                  cal.setOrgSearchQuery(e.currentTarget.value);
                  cal.setOrgDropdownOpen(true);
                }}
              />
              <Show when={cal.orgDropdownOpen()}>
                <div class={styles["org-dropdown"]}>
                  <Show when={cal.filteredOrgs().length === 0}>
                    <div class={styles["org-option-empty"]}>
                      Aucune organisation trouvée
                    </div>
                  </Show>
                  <For each={cal.filteredOrgs()}>
                    {(org) => (
                      <button
                        type="button"
                        class={styles["org-option"]}
                        onClick={() => {
                          cal.selectOrg(org);
                          cal.setOrgDropdownOpen(false);
                          cal.setOrgSearchQuery("");
                        }}
                      >
                        {org.name}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </div>

        <div class={styles["filter-include-past"]}>
          <label class={styles["include-past-label"]}>
            <input
              type="checkbox"
              class={styles["include-past-checkbox"]}
              checked={cal.includePast()}
              onChange={(e) =>
                void cal.setIncludePastAndReload(e.currentTarget.checked)
              }
            />
            {/* Classe sans regle CSS : gardee litterale pour ne pas changer le DOM. */}
            <span class="include-past-text">Inclure les événements passés</span>
          </label>
          <Show when={cal.loadingPast()}>
            <span
              classList={{
                [styles["include-past-loading"]]: true,
                [styles.animate]: true,
              }}
            >
              <Icon raw={hourglassRaw} />
              <span>Chargement...</span>
            </span>
          </Show>
        </div>

        <div class={styles["filter-section-label"]}>Thématiques</div>
        <div class={styles["chip-row"]}>
          <For each={cal.allCategories}>
            {(cat) => (
              <button
                type="button"
                classList={{
                  [styles.chip]: true,
                  [styles["chip-category"]]: true,
                  [styles["chip-active"]]: cal
                    .selectedCategories()
                    .has(cat.name),
                }}
                style={{
                  "--chip-color": cat.color,
                  "--chip-bg": cat.bg,
                  "--chip-text": cat.text,
                }}
                onClick={() => cal.toggleCategory(cat.name)}
              >
                <span>{cat.label}</span>
              </button>
            )}
          </For>
        </div>

        <div class={styles["filter-section-label"]}>Publics</div>
        <div class={styles["chip-row"]}>
          <For each={cal.audiences}>
            {(aud) => (
              <button
                type="button"
                classList={{
                  [styles.chip]: true,
                  [styles["chip-audience"]]: true,
                  [styles["chip-active"]]: cal
                    .selectedAudiences()
                    .has(aud.name),
                }}
                onClick={() => cal.toggleAudience(aud.name)}
              >
                {aud.label}
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
