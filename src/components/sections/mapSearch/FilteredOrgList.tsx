import { For, Show } from "solid-js";
import { useStore } from "@nanostores/solid";
import Icon from "../../icons/Icon";
import ContactRow from "./parts/ContactRow";
import ReadMore from "./parts/ReadMore";
import { $mapData } from "../../../lib/mapStore";
import arrowRaw from "../../../assets/images/circle-arrow-right.svg?raw";
import pinRaw from "../../../assets/images/map-pin.svg?raw";
import styles from "./FilteredOrgList.module.css";

export default function FilteredOrgList() {
  // nanostores stays the cross-island bus: Map.astro (Leaflet) keeps its own
  // plain $mapData.subscribe(), outside Solid.
  const orgs = useStore($mapData);

  return (
    <div class={styles["filtered-orgs"]}>
      <Show when={orgs().length > 0}>
        <p class={styles["filtered-orgs-count"]}>
          <span>{orgs().length}</span>
          <span>{orgs().length > 1 ? " organisations" : " organisation"}</span>
        </p>
      </Show>

      <div class={styles["filtered-orgs-list"]}>
        <For each={orgs()}>
          {(org, i) => (
            <div
              classList={{
                // .org-card, .result-card and .read-more-wrap carry no rules
                // in this component's styles — the timeline's versions were
                // Astro-scoped and never reached here — so they stay literal.
                [styles["org-card"]]: true,
                [styles["result-card-2"]]: i() % 2 !== 0,
                "result-card": i() % 2 === 0,
              }}
            >
              <h3 class={styles["result-card-title"]}>{org.name}</h3>

              <Show when={org.address || org.city}>
                <p class={styles["org-address"]}>
                  <span class={styles["org-address-icon"]}>
                    <Icon raw={pinRaw} />
                  </span>
                  <span>
                    {[org.address, org.city].filter(Boolean).join(", ")}
                  </span>
                </p>
              </Show>

              <Show when={org.desc}>
                <p class={styles["result-card-desc"]}>
                  <ReadMore
                    text={() => org.desc ?? ""}
                    cursorClass="cursor"
                    wrapClass="read-more-wrap"
                    linkClass={styles["read-more-link"]}
                  />
                </p>
              </Show>

              <Show when={org.contact && org.contact.length > 0}>
                <ContactRow
                  contacts={org.contact}
                  rowClass={styles["org-contact-row"]}
                  linkClass={styles["org-contact-link"]}
                  iconClass={styles["org-contact-icon"]}
                />
              </Show>

              <hr class={styles["result-card-separator"]} />

              <div class={styles["result-card-buttons"]}>
                <Show when={org.domain}>
                  <a
                    href={org.domain}
                    target="_blank"
                    classList={{
                      [styles.btn]: true,
                      [styles["btn-site"]]: true,
                    }}
                  >
                    <span>Visiter le site</span>
                    <span class={styles["btn-arrow-circle"]}>
                      <Icon raw={arrowRaw} />
                    </span>
                  </a>
                </Show>
                <Show when={org.lat && org.lon}>
                  <button
                    type="button"
                    classList={{
                      [styles.btn]: true,
                      [styles["btn-zoom"]]: true,
                    }}
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("map-focus-org", {
                          detail: { id: org.id, lat: org.lat, lon: org.lon },
                        }),
                      )
                    }
                  >
                    <span>Voir sur la carte</span>
                    <Icon raw={pinRaw} />
                  </button>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>

      <Show when={orgs().length === 0}>
        <p class={styles["filtered-orgs-empty"]}>
          Aucune organisation ne correspond à ces filtres.
        </p>
      </Show>
    </div>
  );
}
