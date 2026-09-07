import { Index } from "solid-js";
import { useProposalForm } from "./proposeContext";
import type { ArrayField } from "../../../lib/proposalFormState";
import styles from "./FieldArrayText.module.css";

interface FieldArrayTextProps {
  name: ArrayField;
  label: string;
  placeholder?: string;
  type?: "text" | "url";
}

export default function FieldArrayText(props: FieldArrayTextProps) {
  const f = useProposalForm();
  return (
    <div class={styles.field}>
      <label class={styles["field-label"]}>{props.label}</label>
      <div class={styles["array-items"]}>
        {/*
          <Index> et non <For> : ce sont des string[] edites sur place. <For>
          est keye par reference de valeur, il recreerait donc l'<input> a
          chaque frappe — perte du focus et du curseur. <Index> est keye par
          position, ce qui est l'idiome correct ici.
        */}
        <Index each={f.form[props.name]}>
          {(item, idx) => (
            <div class={styles["array-item"]}>
              <input
                type={props.type ?? "text"}
                class={styles["field-input"]}
                placeholder={props.placeholder}
                value={item()}
                onInput={(e) =>
                  f.setArrayItem(props.name, idx, e.currentTarget.value)
                }
              />
              <button
                type="button"
                class={styles["array-remove"]}
                onClick={() => f.removeArrayItem(props.name, idx)}
                aria-label="Retirer cette entrée"
              >
                ×
              </button>
            </div>
          )}
        </Index>
        <button
          type="button"
          class={styles["array-add"]}
          onClick={() => f.pushArrayItem(props.name)}
        >
          + Ajouter
        </button>
      </div>
    </div>
  );
}
