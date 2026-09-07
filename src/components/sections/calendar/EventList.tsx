import { For, Show } from "solid-js";
import Background from "../general/Background";
import Icon from "../../icons/Icon";
import { useCalendar } from "./calendarContext";
import arrowRaw from "../../../assets/images/circle-arrow-right.svg?raw";
import pinRaw from "../../../assets/images/map-pin.svg?raw";
import clockRaw from "../../../assets/images/clock.svg?raw";
import hourglassRaw from "../../../assets/images/hourglass-empty.svg?raw";
import styles from "./EventList.module.css";

export default function EventList() {
  const cal = useCalendar();
  return (
    <>
      <Show when={!cal.loading()}>
        <div class={styles["event-list"]}>
          <Background />
          <Show when={cal.visibleEvents().length === 0}>
            <div class={styles["empty-state"]}>
              Aucun événement ce mois-ci. Tu peux changer de mois ou ajuster les
              filtres.
            </div>
          </Show>

          <For each={cal.pagedEvents()}>
            {(event) => (
              <article
                classList={{
                  [styles["event-row"]]: true,
                  [styles["event-row-expanded"]]: cal.expandedId() === event.id,
                  [styles["event-row-past"]]: event.isPast,
                }}
              >
                <button
                  type="button"
                  class={styles["event-row-clickable"]}
                  onClick={() => cal.toggleExpand(event.id)}
                >
                  <div class={styles["event-date-col"]}>
                    <div class={styles["event-date-block"]}>
                      <div class={styles["event-date-day"]}>
                        {event.startDay}
                      </div>
                      <div class={styles["event-date-month"]}>
                        {event.startMonth}
                      </div>
                    </div>
                    <Show when={event.hasEnd}>
                      <div
                        classList={{
                          [styles["event-date-block"]]: true,
                          [styles["event-date-block-end"]]: true,
                        }}
                      >
                        <div class={styles["event-date-day"]}>
                          {event.endDay}
                        </div>
                        <div class={styles["event-date-month"]}>
                          {event.endMonth}
                        </div>
                      </div>
                    </Show>
                  </div>

                  <div class={styles["event-body-col"]}>
                    <h3 class={styles["event-title"]}>{event.title}</h3>
                    <Show when={event.location}>
                      <div class={styles["event-location"]}>
                        <Icon raw={pinRaw} />
                        <span>{event.location}</span>
                      </div>
                    </Show>
                  </div>

                  <div class={styles["event-desc-col"]}>
                    <Show when={cal.expandedId() !== event.id}>
                      <p class={styles["event-desc-preview"]}>
                        {event.shortContent}
                      </p>
                    </Show>
                  </div>
                </button>

                {/*
                  Replaces x-collapse: the grid-template-rows 0fr -> 1fr
                  technique already used by .filter-section in this project.
                  The content stays mounted so the transition runs both ways.
                */}
                <div
                  classList={{
                    [styles["event-expanded"]]: true,
                    [styles["event-expanded-open"]]:
                      cal.expandedId() === event.id,
                  }}
                >
                  <div class={styles["event-expanded-inner"]}>
                    <div class={styles["event-expanded-body"]}>
                      <Show when={event.content}>
                        <p class={styles["event-content"]}>{event.content}</p>
                      </Show>

                      <Show when={event.timeLabel}>
                        <div class={styles["event-times"]}>
                          <Icon raw={clockRaw} />
                          <span>{event.timeLabel}</span>
                        </div>
                      </Show>

                      <Show
                        when={event.categories && event.categories.length > 0}
                      >
                        <div class={styles["event-tags"]}>
                          <For each={event.categories}>
                            {(cat) => (
                              <span
                                class={styles["event-tag"]}
                                style={cal.getCategoryStyle(cat)}
                              >
                                {cat}
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>

                      <Show when={event.url}>
                        <a
                          href={event.url ?? undefined}
                          target="_blank"
                          rel="noopener"
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
                  </div>
                </div>
              </article>
            )}
          </For>

          <Show when={cal.remainingCount() > 0}>
            <div class={styles["load-more-wrap"]}>
              <button
                type="button"
                class={styles["load-more-btn"]}
                onClick={() => cal.loadMore()}
              >
                <span>
                  {`Voir plus d'événements (${cal.remainingCount()} restant${
                    cal.remainingCount() > 1 ? "s" : ""
                  })`}
                </span>
              </button>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={cal.loading()}>
        <div
          classList={{
            [styles["loading-state"]]: true,
            [styles.animate]: true,
          }}
        >
          <span>Chargement des événements...</span>
          <Icon raw={hourglassRaw} />
        </div>
      </Show>
    </>
  );
}
