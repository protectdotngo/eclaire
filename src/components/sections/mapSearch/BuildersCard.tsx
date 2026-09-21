import Icon from "../../icons/Icon";
import { BUILDERS_COPY, BUILDERS_URL } from "../../../data/buildersCard";
import type { ReplyLang } from "../../../interfaces/chat";
import arrowRaw from "../../../assets/images/circle-arrow-right.svg?raw";
import styles from "./ConversationTimeline.module.css";

interface BuildersCardProps {
  lang: ReplyLang;
}

/**
 * Promotion of The Builders shown when the user speaks as an organisation
 * (EC-41). Everything it displays comes from BUILDERS_COPY — nothing here is
 * model output, so there is no typewriter and no streaming state.
 */
export default function BuildersCard(props: BuildersCardProps) {
  const copy = () => BUILDERS_COPY[props.lang] ?? BUILDERS_COPY.fr;

  return (
    <div class={styles["builders-card"]}>
      <span class={styles["builders-tag"]}>{copy().tag}</span>
      <h3 class={styles["result-card-title"]}>{copy().title}</h3>
      <p class={styles["result-card-desc"]}>{copy().body}</p>

      <hr class={styles["result-card-separator"]} />

      <div class={styles["result-card-buttons"]}>
        <a
          href={BUILDERS_URL}
          target="_blank"
          rel="noopener noreferrer"
          classList={{
            [styles.btn]: true,
            [styles["btn-site"]]: true,
          }}
        >
          <span>{copy().cta}</span>
          <span class={styles["btn-arrow-circle"]}>
            <Icon raw={arrowRaw} />
          </span>
        </a>
      </div>
    </div>
  );
}
