import type { Accessor, Setter } from "solid-js";
import type { OrgWithChatContext } from "./org";

/**
 * The leaves driven by the typewriter carry their own signal.
 *
 * This is what lets one keystroke re-evaluate a single text binding, and above
 * all what makes `reset()` mid-typing harmless: the in-flight loop captures
 * the *setter*, so writing into a detached signal with no subscriber is a
 * silent no-op — exactly Alpine's semantics, where the loop mutated a detached
 * object literal.
 */
export interface DisplayedOrg extends OrgWithChatContext {
  displayName: Accessor<string>;
  setDisplayName: Setter<string>;
  displayDesc: Accessor<string>;
  setDisplayDesc: Setter<string>;
  streaming: Accessor<boolean>;
  setStreaming: Setter<boolean>;
}

export interface DisplayedEvent {
  id?: string;
  title: string;
  content?: string;
  location?: string;
  url?: string;
  dateLabel?: string;
  orgs: Array<{ id: string; name: string; domain: string | null }>;
  displayTitle: Accessor<string>;
  setDisplayTitle: Setter<string>;
  displayContent: Accessor<string>;
  setDisplayContent: Setter<string>;
  streaming: Accessor<boolean>;
  setStreaming: Setter<boolean>;
}

export type TimelineNode =
  | {
      kind: "message";
      role: "assistant";
      content: string;
      displayContent: Accessor<string>;
      setDisplayContent: Setter<string>;
      streaming: Accessor<boolean>;
      setStreaming: Setter<boolean>;
    }
  | {
      kind: "orgs";
      displayed: Accessor<readonly DisplayedOrg[]>;
      push(org: DisplayedOrg): void;
    }
  | {
      kind: "events";
      displayed: Accessor<readonly DisplayedEvent[]>;
      push(ev: DisplayedEvent): void;
    };

/**
 * One entry in the conversation.
 *
 * The `turn` variant was already being pushed by `mapSearchState.ts` but was
 * missing from this type, hence the `as unknown as TimelineItem` casts — the
 * typing becomes honest.
 */
export type TimelineItem =
  | { kind: "message"; role: "user"; content: string }
  | {
      kind: "turn";
      children: Accessor<readonly TimelineNode[]>;
      push(node: TimelineNode): void;
    };
