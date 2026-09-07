import { For } from "solid-js";
import { useProposalForm } from "./proposeContext";
import { ALL_CATEGORIES, AUDIENCES } from "../../../lib/taxonomy";
import styles from "./FieldCategories.module.css";

export default function FieldCategories() {
  const f = useProposalForm();
  return (
    <div class={styles.field}>
      <label class={styles["field-label"]}>
        Catégories thématiques
        <span class={styles["field-required"]}>*</span>
      </label>
      <p class={styles["field-hint"]}>
        Sélectionne toutes les catégories qui décrivent ton organisation.
      </p>
      <div class={styles["chip-row"]}>
        {/*
          `cat` is in the <For>'s scope: no need to stash the value in data-cat
          and read it back via $el.dataset.cat the way the Alpine
          implementation did.
        */}
        <For each={ALL_CATEGORIES}>
          {(cat) => (
            <button
              type="button"
              classList={{
                [styles.chip]: true,
                [styles["chip-category"]]: true,
                [styles["chip-active"]]: f.form.categories.includes(cat.name),
              }}
              style={{
                "--chip-color": cat.color,
                "--chip-bg": cat.bg,
                "--chip-text": cat.text,
              }}
              onClick={() => f.toggleCategory(cat.name)}
            >
              <span class={styles.dot} />
              <span>{cat.label}</span>
            </button>
          )}
        </For>
      </div>

      <label class={styles["field-label-public"]}>
        Publics visés
        <span class={styles["field-required"]}>*</span>
      </label>
      <p class={styles["field-hint"]}>
        Sélectionne les publics que ton organisation cible.
      </p>
      <div class={styles["chip-row"]}>
        <For each={AUDIENCES}>
          {(aud) => (
            <button
              type="button"
              classList={{
                [styles.chip]: true,
                [styles["chip-audience"]]: true,
                [styles["chip-active"]]: f.form.audience.includes(aud.name),
              }}
              onClick={() => f.toggleAudience(aud.name)}
            >
              {aud.label}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
