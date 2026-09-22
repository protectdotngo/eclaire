import { For } from "solid-js";
import Icon from "../../icons/Icon";
import { useMapSearch } from "./mapSearchContext";
import sparkleRaw from "../../../assets/images/question-star.svg?raw";
import styles from "./QuickQuestions.module.css";

/** Was three hand-written buttons carrying their text in data-question. */
const QUICK_QUESTIONS = [
  {
    label: "Je cherche une formation aux réseaux sociaux sur Genève",
    question: "Je cherche une formation aux réseaux sociaux sur Genève",
  },
  {
    label: "Je suis entre deux boulots, comment me former à l'IA ?",
    question: "Je suis entre deux boulots, comment me former à l'IA ?",
  },
  {
    label:
      "Je m'inquiète du temps passé par mes enfants sur les réseaux sociaux",
    question:
      "Je m'inquiète du temps passé par mes enfants sur les réseaux sociaux",
  },
] as const;

export default function QuickQuestions() {
  const { chat, shell } = useMapSearch();

  return (
    <div
      classList={{
        [styles["quick-questions"]]: true,
        none: shell.view() !== "chat",
      }}
    >
      <span class={styles["quick-questions-label"]}>
        Questions régulièrement posées
      </span>
      <div class={styles["quick-questions-chips"]}>
        <For each={QUICK_QUESTIONS}>
          {(q) => (
            <button
              type="button"
              class={styles["quick-question-chip"]}
              // Was `body.chat-thinking` plus a querySelectorAll loop setting
              // .disabled on every chip; the global body class is no longer
              // needed because the chips read `thinking` directly.
              disabled={shell.thinking()}
              onClick={() => void chat.send(q.question)}
            >
              <span>{q.label}</span>
              <span class={styles["chip-plus"]}>
                <Icon raw={sparkleRaw} />
              </span>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
