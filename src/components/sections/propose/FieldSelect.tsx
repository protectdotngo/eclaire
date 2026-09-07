import { Show } from "solid-js";
import type { JSX } from "solid-js";
import Icon from "../../icons/Icon";
import chevronDownRaw from "../../../assets/images/chevron-down.svg?raw";
import styles from "./FieldSelect.module.css";

interface FieldSelectProps {
  name: string;
  label: string;
  required?: boolean;
  visualRequired?: boolean;
  value: string;
  onChange: (value: string) => void;
  children?: JSX.Element;
}

export default function FieldSelect(props: FieldSelectProps) {
  return (
    <div class={styles.field}>
      <label class={styles["field-label"]} for={props.name}>
        {props.label}
        <Show when={props.required || props.visualRequired}>
          <span class={styles["field-required"]}>*</span>
        </Show>
      </label>
      <div class={styles["field-select-wrap"]}>
        <select
          id={props.name}
          name={props.name}
          class={styles["field-select"]}
          required={props.required}
          value={props.value}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        >
          {props.children}
        </select>
        <span class={styles["field-chevron"]}>
          <Icon raw={chevronDownRaw} />
        </span>
      </div>
    </div>
  );
}
