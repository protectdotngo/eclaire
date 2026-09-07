import { Show } from "solid-js";
import { useProposalForm } from "./proposeContext";
import type { StringField } from "../../../lib/proposalFormState";
import styles from "./FieldText.module.css";

interface FieldTextProps {
  name: StringField;
  label: string;
  type?: "text" | "email" | "url";
  required?: boolean;
  placeholder?: string;
}

export default function FieldText(props: FieldTextProps) {
  const f = useProposalForm();
  return (
    <div class={styles.field}>
      <label class={styles["field-label"]} for={props.name}>
        {props.label}
        <Show when={props.required}>
          <span class={styles["field-required"]}>*</span>
        </Show>
      </label>
      <input
        id={props.name}
        name={props.name}
        type={props.type ?? "text"}
        class={styles["field-input"]}
        placeholder={props.placeholder}
        required={props.required}
        value={f.form[props.name]}
        onInput={(e) => f.setField(props.name, e.currentTarget.value)}
      />
    </div>
  );
}
