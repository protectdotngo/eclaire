import type { OrgWithChatContext } from "./org";
import type { EventWithOrgs } from "./event";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export interface RequestBody {
  messages: ChatMsg[];
}

export interface EventSearchFilters {
  date_from?: string;
  date_to?: string;
  day_of_week?: number;
  time_of_day?: "morning" | "afternoon" | "evening";
  categories?: string[];
  keywords?: string[];
  city?: string;
  org_ids?: string[];
  audience?: string;
  offset?: number;
}

export type TextBlock = { type: "text"; content: string };

export type OrgsBlock = {
  type: "orgs";
  items: { id: string; reason: string }[];
};

export type EventSearchBlock = {
  type: "event_search";
  filters: EventSearchFilters;
};

/**
 * A block emitted by the LLM in its response.
 * Discriminated union based on the `type` field.
 */
export type Block = TextBlock | OrgsBlock | EventSearchBlock;

/**
 * The LLM's structured response — an ordered list of blocks.
 */
export type ChatResponse = { blocks: Block[] };

/**
 * Response returned by /api/chat: LLM blocks + hydrated data.
 */
export interface ChatApiResponse {
  blocks: Block[];
  orgs: OrgWithChatContext[];
  events: EventWithOrgs[];
  hasMoreEvents?: boolean;
  eventOffset?: number;
  fabricatedIdsFiltered?: number;
}
