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
          <Index>, not <For>: these are string[] edited in place. <For> is keyed
          by value reference, so it would recreate the <input> on every
          keystroke — losing focus and caret position. <Index> is keyed by
          position, which is the correct idiom here.
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
