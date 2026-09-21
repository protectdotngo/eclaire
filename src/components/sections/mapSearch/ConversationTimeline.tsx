import { For, Match, Show, Switch } from "solid-js";
import OrgCard from "./OrgCard";
import EventCard from "./EventCard";
import BuildersCard from "./BuildersCard";
import { useMapSearch } from "./mapSearchContext";
import { renderMarkdown } from "../../../lib/text";
import styles from "./ConversationTimeline.module.css";

export default function ConversationTimeline() {
  const { timeline } = useMapSearch();

  return (
    <div class={styles["ai-timeline"]}>
      {/*
        Where 30 nested <template x-for>/<template x-if> used to sit, 8 levels
        deep. <For> is keyed by reference over an append-only list, so adding an
        item creates exactly one row and leaves the existing DOM alone.
      */}
      <For each={timeline.items()}>
        {(item) => (
          <div
            classList={{
              // These three carry no CSS rules in the original either; kept as
              // literal class names so the DOM does not change.
              "ai-timeline-item": true,
              "ai-timeline-item-user":
                item.kind === "message" && item.role === "user",
              "ai-timeline-item-bot": item.kind === "turn",
            }}
          >
            <Switch>
              <Match when={item.kind === "message" ? item : undefined}>
                {(msg) => (
                  <div
                    classList={{
                      [styles["ai-chat-msg"]]: true,
                      [styles["ai-chat-msg-user"]]: true,
                    }}
                  >
                    <span>{msg().content}</span>
                  </div>
                )}
              </Match>
              <Match when={item.kind === "turn" ? item : undefined}>
                {(turn) => (
                  <div class={styles["ai-turn"]}>
                    <For each={turn().children()}>
                      {(node) => (
                        <div class={styles["ai-turn-node"]}>
                          <Switch>
                            <Match
                              when={node.kind === "message" ? node : undefined}
                            >
                              {(msg) => (
                                <div
                                  classList={{
                                    [styles["ai-chat-msg"]]: true,
                                    [styles["ai-chat-msg-assistant"]]: true,
                                  }}
                                >
                                  <div>
                                    {/*
                                      Markdown is parsed once, when the
                                      non-streaming branch mounts — not on every
                                      keystroke. Alpine kept both branches in the
                                      DOM via x-show and re-evaluated x-html
                                      while typing.
                                    */}
                                    <Show
                                      when={msg().streaming()}
                                      fallback={
                                        <div
                                          class={
                                            styles[
                                              "ai-chat-msg-assistant-content"
                                            ]
                                          }
                                          innerHTML={renderMarkdown(
                                            msg().content,
                                          )}
                                        />
                                      }
                                    >
                                      <span>{msg().displayContent()}</span>
                                      <span class="cursor">▊</span>
                                    </Show>
                                  </div>
                                </div>
                              )}
                            </Match>
                            <Match
                              when={node.kind === "orgs" ? node : undefined}
                            >
                              {(orgs) => (
                                <div class={styles["ai-orgs-block"]}>
                                  <For each={orgs().displayed()}>
                                    {(org, i) => (
                                      <OrgCard org={org} index={i()} />
                                    )}
                                  </For>
                                </div>
                              )}
                            </Match>
                            <Match
                              when={node.kind === "events" ? node : undefined}
                            >
                              {(events) => (
                                <div class={styles["ai-events-block"]}>
                                  <For each={events().displayed()}>
                                    {(ev, i) => (
                                      <EventCard event={ev} index={i()} />
                                    )}
                                  </For>
                                </div>
                              )}
                            </Match>
                            <Match
                              when={node.kind === "builders" ? node : undefined}
                            >
                              {(builders) => (
                                <BuildersCard lang={builders().lang} />
                              )}
                            </Match>
                          </Switch>
                        </div>
                      )}
                    </For>
                  </div>
                )}
              </Match>
            </Switch>
          </div>
        )}
      </For>
      <Show when={timeline.thinking()}>
        <div class={styles["ai-chat-thinking"]}>
          <span />
          <span />
          <span />
        </div>
      </Show>
    </div>
  );
}
