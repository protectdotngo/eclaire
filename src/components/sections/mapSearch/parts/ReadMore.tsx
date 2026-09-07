import { createSignal, Show } from "solid-js";
import type { Accessor } from "solid-js";
import { truncate } from "../../../../lib/text";

interface ReadMoreProps {
  /** The full text; an accessor so it can stream in. */
  text: Accessor<string>;
  limit?: number;
  /** While true the cursor shows and the read-more link is withheld. */
  streaming?: Accessor<boolean>;
  /** Class names, supplied by the owning component's CSS module. */
  cursorClass: string;
  wrapClass: string;
  linkClass: string;
}

/**
 * The "read more" toggle, previously an anonymous inline `x-data` copy-pasted
 * three times (ConversationTimeline twice, FilteredOrgList once).
 */
export default function ReadMore(props: ReadMoreProps) {
  const [expanded, setExpanded] = createSignal(false);
  const limit = () => props.limit ?? 120;
  const streaming = () => props.streaming?.() ?? false;
  const needsTruncation = () => props.text().length > limit();

  return (
    <>
      <span>{expanded() ? props.text() : truncate(props.text(), limit())}</span>
      <Show when={streaming()}>
        <span class={props.cursorClass}>▊</span>
      </Show>
      <Show when={!streaming() && needsTruncation()}>
        <span class={props.wrapClass}>
          <br />
          <span class={props.linkClass} onClick={() => setExpanded((v) => !v)}>
            {expanded() ? "Réduire" : "Lire plus"}
          </span>
        </span>
      </Show>
    </>
  );
}
