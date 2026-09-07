import { For, Show } from "solid-js";
import Icon from "../../../icons/Icon";
import { formatContactHref, isEmail, isPhone } from "../../../../lib/contact";
import mailRaw from "../../../../assets/images/mail.svg?raw";
import phoneRaw from "../../../../assets/images/phone.svg?raw";

interface ContactRowProps {
  contacts: readonly string[];
  rowClass: string;
  linkClass: string;
  iconClass: string;
}

/**
 * The contact links row. The markup was identical in ConversationTimeline and
 * FilteredOrgList; only the (now hashed) class names differ, so they are passed
 * in by the caller.
 */
export default function ContactRow(props: ContactRowProps) {
  return (
    <div class={props.rowClass}>
      <For each={props.contacts}>
        {(c) => (
          <a href={formatContactHref(c)} class={props.linkClass}>
            <Show when={isEmail(c)}>
              <Icon raw={mailRaw} class={props.iconClass} />
            </Show>
            <Show when={isPhone(c)}>
              <Icon raw={phoneRaw} class={props.iconClass} />
            </Show>
            <span>{c}</span>
          </a>
        )}
      </For>
    </div>
  );
}
