import { For, Show } from "solid-js";
import Icon from "../../icons/Icon";
import ReadMore from "./parts/ReadMore";
import type { DisplayedEvent } from "../../../interfaces/timeline";
import arrowRaw from "../../../assets/images/circle-arrow-right.svg?raw";
import calendarRaw from "../../../assets/images/calendar.svg?raw";
import pinRaw from "../../../assets/images/map-pin.svg?raw";
import styles from "./ConversationTimeline.module.css";

interface EventCardProps {
  event: DisplayedEvent;
  index: number;
}

export default function EventCard(props: EventCardProps) {
  const ev = props.event;
  return (
    <div
      classList={{
        [styles["event-card"]]: true,
        [styles["result-card-2"]]: props.index % 2 !== 0,
        [styles["result-card"]]: props.index % 2 === 0,
      }}
    >
      <span class={styles["event-tag"]}>ÉVÉNEMENT</span>
      <h3 class={styles["result-card-title"]}>{ev.displayTitle()}</h3>

      <div class={styles["event-meta"]}>
        <Show when={ev.dateLabel}>
          <div class={styles["event-meta-item"]}>
            <Icon raw={calendarRaw} />
            <span>{ev.dateLabel}</span>
          </div>
        </Show>
        <Show when={ev.location}>
          <div class={styles["event-meta-item"]}>
            <Icon raw={pinRaw} />
            <span>{ev.location}</span>
          </div>
        </Show>
      </div>

      <Show when={ev.content}>
        <p class={styles["result-card-desc"]}>
          <ReadMore
            text={ev.displayContent}
            streaming={ev.streaming}
            cursorClass="cursor"
            wrapClass={styles["read-more-wrap"]}
            linkClass={styles["read-more-link"]}
          />
        </p>
      </Show>

      <Show when={!ev.streaming() && ev.orgs && ev.orgs.length > 0}>
        <div class={styles["event-orgs-row"]}>
          <span class={styles["event-orgs-label"]}>Proposé par :</span>
          <For each={ev.orgs}>
            {(o, oi) => (
              <span class="event-org-wrap">
                <Show when={o.domain} fallback={<span>{o.name}</span>}>
                  <a
                    href={o.domain ?? undefined}
                    target="_blank"
                    class={styles["event-org-link"]}
                  >
                    {o.name}
                  </a>
                </Show>
                <Show when={oi() < ev.orgs.length - 1}>
                  <span>,&nbsp;</span>
                </Show>
              </span>
            )}
          </For>
        </div>
      </Show>

      <Show when={!ev.streaming() && ev.url}>
        <hr class={styles["result-card-separator"]} />
      </Show>

      <Show when={!ev.streaming()}>
        <div class={styles["result-card-buttons"]}>
          <Show when={ev.url}>
            <a
              href={ev.url}
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
        </div>
      </Show>
    </div>
  );
}
