import type { Data } from "./dbData";

export interface Block {
  type: "text" | "orgs" | "event_search";
  content?: string;
  items?: { id: string; reason: string }[];
  filters?: {
    date_from?: string;
    date_to?: string;
    day_of_week?: number;
    time_of_day?: string;
    categories?: string[];
    keywords?: string[];
    city?: string;
    org_ids?: string[];
    audience?: string;
  };
}

export interface UpcomingEvent {
  id: string;
  title: string;
  url: string | null;
}

export interface DisplayedItem {
  id?: string;
  domain?: string;
  name: string;
  desc?: string;
  reason?: string;
  upcomingEvent?: UpcomingEvent | null;
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

export interface SearchResult {
  id?: string;
  domain?: string;
  name: string;
  desc?: string;
  reason?: string;
  upcomingEvent?: UpcomingEvent | null;
}

export interface EventResult {
  id: string;
  title: string | null;
  content: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  url: string | null;
  categories: string[] | null;
  orgs: Array<{ id: string; name: string; domain: string | null }>;
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export interface ChatApiResponse {
  blocks: Block[];
  orgs: Data[];
  events: EventResult[];
}

export type TimelineItem =
  | {
      kind: "message";
      role: "user" | "assistant";
      content: string;
      displayContent: string;
      streaming: boolean;
    }
  | { kind: "orgs"; displayed: DisplayedItem[] }
  | { kind: "events"; displayed: DisplayedEvent[] };
