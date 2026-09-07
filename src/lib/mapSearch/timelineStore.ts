import { createSignal } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import type { ChatMsg } from "../../interfaces/chat";
import type { EventWithOrgs } from "../../interfaces/event";
import type { OrgWithChatContext } from "../../interfaces/org";
import type {
  DisplayedEvent,
  DisplayedOrg,
  TimelineItem,
  TimelineNode,
} from "../../interfaces/timeline";

function formatEventDate(
  startDate: string | null,
  endDate: string | null,
): string | undefined {
  if (!startDate && !endDate) return "Récurrent ou non daté";
  const fmt = (iso: string): string => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const date = d.toLocaleDateString("fr-CH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
    if (!hasTime) return date;
    const time = d.toLocaleTimeString("fr-CH", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date}, ${time}`;
  };
  if (startDate && endDate && startDate !== endDate) {
    return `${fmt(startDate)} — ${fmt(endDate)}`;
  }
  if (startDate) return fmt(startDate);
  if (endDate) return fmt(endDate);
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** An append-only list: an array signal replaced on push. */
function createList<T>(): {
  items: Accessor<readonly T[]>;
  push(item: T): void;
  clear(): void;
} {
  const [items, setItems] = createSignal<readonly T[]>([]);
  return {
    items,
    push: (item) => setItems((prev) => [...prev, item]),
    clear: () => setItems([]),
  };
}

export interface TimelineStore {
  items: Accessor<readonly TimelineItem[]>;
  thinking: Accessor<boolean>;
  setThinking(v: boolean): void;
  /** Appends, then *awaits* the typewriter (the former message-done event). */
  addMessage(msg: ChatMsg): Promise<void>;
  /** The former orgs-done event. */
  addOrgs(orgs: readonly OrgWithChatContext[]): Promise<void>;
  /** The former events-done event. */
  addEvents(events: readonly EventWithOrgs[]): Promise<void>;
  reset(): void;
  /** Replaces getElementById("ai-response-cont"). */
  setScrollContainer(el: HTMLElement | undefined): void;
}

export function createTimelineStore(): TimelineStore {
  const list = createList<TimelineItem>();
  const [thinking, setThinking] = createSignal(false);
  let scrollContainer: HTMLElement | undefined;

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }, 50);
  };

  /**
   * Returns the open assistant turn, creating one if the last item isn't one.
   * Consecutive assistant items collect into a single turn so they render as
   * one bordered card; a user message closes the turn (see addMessage).
   *
   * No need to re-read the array to get back a reactive proxy the way Alpine
   * required: the object *is* the handle.
   */
  function currentTurn(): Extract<TimelineItem, { kind: "turn" }> {
    const items = list.items();
    const last = items[items.length - 1];
    if (last && last.kind === "turn") return last;
    const children = createList<TimelineNode>();
    const turn = {
      kind: "turn" as const,
      children: children.items,
      push: children.push,
    };
    list.push(turn);
    return turn;
  }

  /**
   * Generic typewriter: it takes a setter, which replaces the three
   * near-duplicates typeInto / typeIntoEvent / typeIntoMessage.
   *
   * `onTick` exists because only the message stream scrolled on every
   * keystroke — an asymmetry preserved as-is.
   */
  function typeInto(
    setter: Setter<string>,
    fullText: string,
    msPerChar: number,
    onTick?: () => void,
  ): Promise<void> {
    return new Promise((resolve) => {
      let i = 0;
      const tick = () => {
        const chunk = Math.max(1, Math.floor(Math.random() * 4) + 1);
        i = Math.min(i + chunk, fullText.length);
        setter(fullText.slice(0, i));
        onTick?.();
        if (i < fullText.length) {
          setTimeout(tick, msPerChar + Math.random() * 20);
        } else {
          resolve();
        }
      };
      tick();
    });
  }

  return {
    items: list.items,
    thinking,
    setThinking,

    async addMessage(msg: ChatMsg) {
      if (msg.role === "user") {
        // A user message stands alone and closes any open turn.
        list.push({ kind: "message", role: "user", content: msg.content });
        scrollToBottom();
        return;
      }

      const turn = currentTurn();
      const [displayContent, setDisplayContent] = createSignal("");
      const [streaming, setStreaming] = createSignal(true);
      turn.push({
        kind: "message",
        role: "assistant",
        content: msg.content,
        displayContent,
        setDisplayContent,
        streaming,
        setStreaming,
      });

      await typeInto(setDisplayContent, msg.content, 12, scrollToBottom);
      setStreaming(false);
      scrollToBottom();
    },

    async addOrgs(orgs: readonly OrgWithChatContext[]) {
      const turn = currentTurn();
      const block = createList<DisplayedOrg>();
      turn.push({ kind: "orgs", displayed: block.items, push: block.push });

      for (const org of orgs) {
        const [displayName, setDisplayName] = createSignal("");
        const [displayDesc, setDisplayDesc] = createSignal("");
        const [streaming, setStreaming] = createSignal(true);
        block.push({
          ...org,
          displayName,
          setDisplayName,
          displayDesc,
          setDisplayDesc,
          streaming,
          setStreaming,
        });

        await typeInto(setDisplayName, org.name, 25);
        if (org.desc) {
          await typeInto(setDisplayDesc, org.desc, 8);
        }
        setStreaming(false);
        scrollToBottom();
        await sleep(120);
      }
    },

    async addEvents(events: readonly EventWithOrgs[]) {
      const turn = currentTurn();
      const block = createList<DisplayedEvent>();
      turn.push({ kind: "events", displayed: block.items, push: block.push });

      for (const ev of events) {
        const title = ev.title ?? "Sans titre";
        const content = ev.content ?? undefined;
        const [displayTitle, setDisplayTitle] = createSignal("");
        const [displayContent, setDisplayContent] = createSignal("");
        const [streaming, setStreaming] = createSignal(true);
        block.push({
          id: ev.id,
          title,
          content,
          location: ev.location ?? undefined,
          url: ev.url ?? undefined,
          dateLabel: formatEventDate(ev.startDate, ev.endDate),
          orgs: ev.orgs ?? [],
          displayTitle,
          setDisplayTitle,
          displayContent,
          setDisplayContent,
          streaming,
          setStreaming,
        });

        await typeInto(setDisplayTitle, title, 25);
        if (content) {
          await typeInto(setDisplayContent, content, 8);
        }
        setStreaming(false);
        scrollToBottom();
        await sleep(120);
      }
    },

    reset() {
      list.clear();
      setThinking(false);
    },

    setScrollContainer(el) {
      scrollContainer = el;
    },
  };
}
