import type { OrgWithChatContext } from "./org";

export interface DisplayedOrg extends OrgWithChatContext {
  displayName: string;
  displayDesc: string;
  streaming: boolean;
}

export interface DisplayedEvent {
  id?: string;
  title: string;
  content?: string;
  location?: string;
  url?: string;
  dateLabel?: string;
  orgs: Array<{ id: string; name: string; domain: string | null }>;
  displayTitle: string;
  displayContent: string;
  streaming: boolean;
}

export type TimelineItem =
  | {
      kind: "message";
      role: "user" | "assistant";
      content: string;
      displayContent: string;
      streaming: boolean;
    }
  | { kind: "orgs"; displayed: DisplayedOrg[] }
  | { kind: "events"; displayed: DisplayedEvent[] };
