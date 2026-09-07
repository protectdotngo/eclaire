import { Show } from "solid-js";
import { useVerification } from "./verificationContext";
import type { ListItem } from "../../interfaces/verification";
import styles from "./Verification.module.css";

interface VerifCardProps {
  item: ListItem;
  index: number;
}

export default function VerifCard(props: VerifCardProps) {
  const v = useVerification();
  return (
    <div
      classList={{
        [styles["verif-card"]]: true,
        [styles["verif-card-alt"]]: props.index % 2 !== 0,
        [styles.active]: v.activeId() === props.item.verificationId,
      }}
      onClick={() => void v.open(props.item.verificationId)}
    >
      <div class={styles["vc-top"]}>
        <h3 class={styles["vc-title"]}>{props.item.orgName || "(sans nom)"}</h3>
        <span
          classList={{
            [styles.badge]: true,
            [styles.mod]: props.item.action === "modify",
            [styles.new]: props.item.action !== "modify",
          }}
        >
          {props.item.action === "modify" ? "Modification" : "Nouvelle org"}
        </span>
      </div>
      <div class={styles["vc-meta"]}>
        <span class={styles["vc-chip"]}>
          Score :{" "}
          <span>
            {props.item.legitimacyScore != null
              ? props.item.legitimacyScore + "/10"
              : "—"}
          </span>
        </span>
        <span class={styles["vc-chip"]}>
          {props.item.verdict || "verdict n/a"}
        </span>
      </div>
      <Show when={props.item.submitterEmail}>
        <p class={styles["vc-sub"]}>{props.item.submitterEmail}</p>
      </Show>
      <hr class={styles["vc-separator"]} />
      <button type="button" class={styles["vc-btn"]}>
        <span>Ouvrir le formulaire</span>
        <span class={styles["vc-arrow"]}>→</span>
      </button>
    </div>
  );
}
