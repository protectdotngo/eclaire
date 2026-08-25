import { marked } from "marked";
import type {
  OrgWithChatContext,
  DisplayedOrg,
  DisplayedEvent,
  EventWithOrgs,
  TimelineItem,
  ChatMsg,
} from "../interfaces";

marked.setOptions({
  breaks: true,
  gfm: true,
});

export function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}

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

export function createConversationTimeline() {
  return {
    items: [] as TimelineItem[],
    thinking: false,
    renderMarkdown,
    _nodeSeq: 0,

    init() {},

    // Returns the currently open assistant "turn" group, creating one if the
    // last item isn't an open turn. Consecutive non-user items (assistant
    // messages, orgs, events) collect into one turn so they render as a single
    // bordered card. A user message closes the turn (see addMessage).
    currentTurn() {
      const last = this.items[this.items.length - 1] as any;
      if (last && last.kind === "turn") return last;
      this.items.push({
        kind: "turn",
        children: [],
      } as unknown as TimelineItem);
      // re-fetch from the array so we return Alpine's reactive proxy, not the
      // raw object literal (mutating the literal wouldn't trigger re-render)
      return this.items[this.items.length - 1] as any;
    },

    async addMessage(msg: ChatMsg) {
      if (msg.role === "user") {
        // user message is standalone and closes any open turn
        this.items.push({
          kind: "message",
          role: msg.role,
          content: msg.content,
          displayContent: msg.content,
          streaming: false,
        });
        this.scrollToBottom();
        return;
      }

      const turn = this.currentTurn();
      turn.children.push({
        kind: "message",
        role: msg.role,
        content: msg.content,
        displayContent: "",
        streaming: true,
        _id: ++this._nodeSeq,
      });
      const msgRef = turn.children[turn.children.length - 1] as {
        kind: "message";
        role: "user" | "assistant";
        content: string;
        displayContent: string;
        streaming: boolean;
      };

      await this.typeIntoMessage(msgRef, msg.content, 12);
      msgRef.streaming = false;
      this.scrollToBottom();

      window.dispatchEvent(new CustomEvent("message-done"));
    },

    typeIntoMessage(
      obj: { displayContent: string },
      fullText: string,
      msPerChar: number,
    ): Promise<void> {
      return new Promise((resolve) => {
        let i = 0;
        const tick = () => {
          const chunk = Math.max(1, Math.floor(Math.random() * 4) + 1);
          i = Math.min(i + chunk, fullText.length);
          obj.displayContent = fullText.slice(0, i);
          this.scrollToBottom();
          if (i < fullText.length) {
            setTimeout(tick, msPerChar + Math.random() * 20);
          } else {
            resolve();
          }
        };
        tick();
      });
    },

    isEmail(contact: string): boolean {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim());
    },

    isPhone(contact: string): boolean {
      const digitsOnly = contact.trim().replace(/[\s().-]/g, "");
      return /^\+?\d{7,15}$/.test(digitsOnly);
    },

    formatContactHref(contact: string): string {
      const trimmed = contact.trim();
      if (this.isEmail(trimmed)) {
        return `mailto:${trimmed}`;
      }
      if (this.isPhone(trimmed)) {
        const digitsOnly = trimmed.replace(/[\s().-]/g, "");
        return `tel:${digitsOnly}`;
      }
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
      }
      return trimmed;
    },

    async addOrgs(orgs: OrgWithChatContext[]) {
      const turn = this.currentTurn();
      turn.children.push({ kind: "orgs", displayed: [], _id: ++this._nodeSeq });
      const blockRef = turn.children[turn.children.length - 1] as {
        kind: "orgs";
        displayed: DisplayedOrg[];
      };

      for (const org of orgs) {
        const stub: DisplayedOrg = {
          ...org,
          displayName: "",
          displayDesc: "",
          streaming: true,
        };
        blockRef.displayed.push(stub);
        const orgRef = blockRef.displayed[blockRef.displayed.length - 1];
        await this.typeInto(orgRef, "displayName", org.name, 25);
        if (org.desc) {
          await this.typeInto(orgRef, "displayDesc", org.desc, 8);
        }
        orgRef.streaming = false;
        this.scrollToBottom();
        await this.sleep(120);
      }

      window.dispatchEvent(new CustomEvent("orgs-done"));
    },

    async addEvents(events: EventWithOrgs[]) {
      const turn = this.currentTurn();
      turn.children.push({
        kind: "events",
        displayed: [],
        _id: ++this._nodeSeq,
      });
      const blockRef = turn.children[turn.children.length - 1] as {
        kind: "events";
        displayed: DisplayedEvent[];
      };

      for (const ev of events) {
        const stub: DisplayedEvent = {
          id: ev.id,
          title: ev.title ?? "Sans titre",
          content: ev.content ?? undefined,
          location: ev.location ?? undefined,
          url: ev.url ?? undefined,
          dateLabel: formatEventDate(ev.startDate, ev.endDate),
          orgs: ev.orgs ?? [],
          displayTitle: "",
          displayContent: "",
          streaming: true,
        };
        blockRef.displayed.push(stub);
        const evRef = blockRef.displayed[blockRef.displayed.length - 1];
        await this.typeIntoEvent(evRef, "displayTitle", stub.title, 25);
        if (stub.content) {
          await this.typeIntoEvent(evRef, "displayContent", stub.content, 8);
        }
        evRef.streaming = false;
        this.scrollToBottom();
        await this.sleep(120);
      }

      window.dispatchEvent(new CustomEvent("events-done"));
    },

    typeInto(
      obj: DisplayedOrg,
      key: "displayName" | "displayDesc",
      fullText: string,
      msPerChar: number,
    ): Promise<void> {
      return new Promise((resolve) => {
        let i = 0;
        const tick = () => {
          const chunk = Math.max(1, Math.floor(Math.random() * 4) + 1);
          i = Math.min(i + chunk, fullText.length);
          obj[key] = fullText.slice(0, i);
          if (i < fullText.length) {
            setTimeout(tick, msPerChar + Math.random() * 20);
          } else {
            resolve();
          }
        };
        tick();
      });
    },

    typeIntoEvent(
      obj: DisplayedEvent,
      key: "displayTitle" | "displayContent",
      fullText: string,
      msPerChar: number,
    ): Promise<void> {
      return new Promise((resolve) => {
        let i = 0;
        const tick = () => {
          const chunk = Math.max(1, Math.floor(Math.random() * 4) + 1);
          i = Math.min(i + chunk, fullText.length);
          obj[key] = fullText.slice(0, i);
          if (i < fullText.length) {
            setTimeout(tick, msPerChar + Math.random() * 20);
          } else {
            resolve();
          }
        };
        tick();
      });
    },

    sleep(ms: number): Promise<void> {
      return new Promise((r) => setTimeout(r, ms));
    },

    scrollToBottom() {
      setTimeout(() => {
        const cont = document.getElementById("ai-response-cont");
        if (cont) cont.scrollTop = cont.scrollHeight;
      }, 50);
    },

    reset() {
      this.items = [];
      this.thinking = false;
    },
  };
}
