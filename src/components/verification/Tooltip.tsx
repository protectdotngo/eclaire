import { Show } from "solid-js";
import { useVerification } from "./verificationContext";
import styles from "./Verification.module.css";

export default function Tooltip() {
  const v = useVerification();
  return (
    <Show when={v.tip().text}>
      <div
        class={styles.tooltip}
        role="tooltip"
        style={{ top: `${v.tip().top}px`, left: `${v.tip().left}px` }}
      >
        {v.tip().text}
      </div>
    </Show>
  );
}
