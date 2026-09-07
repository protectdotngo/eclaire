import { Show } from "solid-js";
import Icon from "../../icons/Icon";
import ContactRow from "./parts/ContactRow";
import ReadMore from "./parts/ReadMore";
import MarqueeTitle from "./parts/MarqueeTitle";
import type { DisplayedOrg } from "../../../interfaces/timeline";
import arrowRaw from "../../../assets/images/circle-arrow-right.svg?raw";
import pinRaw from "../../../assets/images/map-pin.svg?raw";
import styles from "./ConversationTimeline.module.css";

interface OrgCardProps {
  org: DisplayedOrg;
  index: number;
}

/**
 * The streaming organisation card rendered inside an assistant turn.
 *
 * Kept separate from FilteredOrgList's card: the two look alike but their CSS
 * has drifted (different .result-card-2 alpha, .result-card-title margin and
 * font-family, .result-card-separator width, .read-more-link colour), so
 * merging them would change how one of the two renders.
 */
export default function OrgCard(props: OrgCardProps) {
  const org = props.org;
  return (
    <div
      classList={{
        // .org-card and .cursor have no CSS rules anywhere: kept as literal
        // class names so the DOM does not change.
        "org-card": true,
        [styles["result-card-2"]]: props.index % 2 !== 0,
        [styles["result-card"]]: props.index % 2 === 0,
      }}
    >
      <h3 class={styles["result-card-title"]}>{org.displayName()}</h3>

      <Show when={org.address || org.city}>
        <p class={styles["org-address"]}>
          <span class={styles["org-address-icon"]}>
            <Icon raw={pinRaw} />
          </span>
          <span>{[org.address, org.city].filter(Boolean).join(", ")}</span>
        </p>
      </Show>

      <Show when={!org.streaming() && org.upcomingEvent}>
        <div class={styles["event-inline-row"]}>
          <span class={styles["event-tag"]}>ÉVÉNEMENT</span>
          <MarqueeTitle
            title={org.upcomingEvent?.title ?? ""}
            wrapClass={styles["event-inline-title-wrap"]}
            titleClass={styles["event-inline-title"]}
            overflowingClass={styles.overflowing}
          />
        </div>
      </Show>

      <Show when={org.desc}>
        <p class={styles["result-card-desc"]}>
          <ReadMore
            text={org.displayDesc}
            streaming={org.streaming}
            cursorClass="cursor"
            wrapClass={styles["read-more-wrap"]}
            linkClass={styles["read-more-link"]}
          />
        </p>
      </Show>

      <Show when={!org.streaming() && org.contact && org.contact.length > 0}>
        <ContactRow
          contacts={org.contact}
          rowClass={styles["org-contact-row"]}
          linkClass={styles["org-contact-link"]}
          iconClass={styles["org-contact-icon"]}
        />
      </Show>

      <Show when={!org.streaming()}>
        <hr class={styles["result-card-separator"]} />
      </Show>

      <Show when={!org.streaming()}>
        <div class={styles["result-card-buttons"]}>
          <Show when={org.upcomingEvent}>
            <a
              href={org.upcomingEvent?.url ?? undefined}
              target="_blank"
              classList={{
                [styles.btn]: true,
                [styles["btn-event"]]: true,
              }}
            >
              <span>Voir l'événement</span>
              <span class={styles["btn-arrow-circle"]}>
                <Icon raw={arrowRaw} />
              </span>
            </a>
          </Show>
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
                // Kept as a window CustomEvent: Map.astro:151 listens for it and
                // Leaflet stays outside Solid.
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
      </Show>
    </div>
  );
}
