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
 * Language the LLM declares for its `text` blocks. Restricted to the five
 * languages the system prompt names, because it keys into server-owned
 * canned strings.
 */
export type ReplyLang = "fr" | "en" | "de" | "it" | "es";

/** Why the deterministic scope guard replaced the model's answer. */
export type ScopeTrip = "model_signal" | "text_too_long";

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
  scopeRedirect?: ScopeTrip;
}

export interface PromptVersion {
  id: string;
  createdAt: string;
  length: number;
}
