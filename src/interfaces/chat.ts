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
  /**
   * Lift the "current or upcoming only" floor and read the window backwards
   * from today. Set only when the user explicitly asks about the past.
   */
  include_past?: boolean;
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
 * Promotion of The Builders (protect.ngo/ge), appended server-side
 * when the user turns out to be speaking *as* an organisation (EC-41).
 *
 * Never emitted by the model: it carries only the reply language, which keys
 * into the server-owned copy in `src/data/buildersCard.ts`.
 */
export type BuildersBlock = {
  type: "builders";
  lang: ReplyLang;
};

/**
 * A block emitted by the LLM in its response.
 * Discriminated union based on the `type` field.
 */
export type Block = TextBlock | OrgsBlock | EventSearchBlock | BuildersBlock;

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
