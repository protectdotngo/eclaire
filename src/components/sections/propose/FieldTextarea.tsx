import { Show } from "solid-js";
import { useProposalForm } from "./proposeContext";
import type { StringField } from "../../../lib/proposalFormState";
import styles from "./FieldTextarea.module.css";

interface FieldTextareaProps {
  name: StringField;
  label: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
}

export default function FieldTextarea(props: FieldTextareaProps) {
  const f = useProposalForm();
  return (
    <div class={styles.field}>
      <label class={styles["field-label"]} for={props.name}>
        {props.label}
        <Show when={props.required}>
          <span class={styles["field-required"]}>*</span>
        </Show>
      </label>
      {/* In Solid a <textarea> takes `value`, never children. */}
      <textarea
        id={props.name}
        name={props.name}
        rows={props.rows ?? 5}
        class={styles["field-textarea"]}
        placeholder={props.placeholder}
        required={props.required}
        value={f.form[props.name]}
        onInput={(e) => f.setField(props.name, e.currentTarget.value)}
      />
    </div>
  );
}
