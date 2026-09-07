import { Match, Show, Switch } from "solid-js";
import { useVerification } from "./verificationContext";
import type { OrgField } from "../../interfaces/verification";
import styles from "./Verification.module.css";

interface VerifFieldProps {
  field: OrgField;
}

export default function VerifField(props: VerifFieldProps) {
  const v = useVerification();
  const state = () => v.fieldState(props.field);
  const id = () => `f-${props.field}`;
  const onInput = (
    e: InputEvent & { currentTarget: HTMLInputElement | HTMLTextAreaElement },
  ) => v.setFieldValue(props.field, e.currentTarget.value);

  return (
    <div class={styles.field}>
      <label for={id()}>
        <span
          classList={{
            [styles["lbl-text"]]: true,
            [styles.green]: state() === "green",
            [styles.red]: state() === "red",
          }}
        >
          {v.fieldLabels[props.field] || props.field}
        </span>
        <Show when={state()}>
          <button
            type="button"
            classList={{
              [styles.help]: true,
              [styles.green]: state() === "green",
              [styles.red]: state() === "red",
            }}
            aria-label="Explication"
            tabindex="0"
            onMouseEnter={(e) => v.showTip(e, props.field)}
            onMouseLeave={() => v.hideTip()}
            onFocus={(e) => v.showTip(e, props.field)}
            onBlur={() => v.hideTip()}
          >
            ?
          </button>
        </Show>
      </label>
      {/* The three mutually exclusive <template x-if> become a <Switch>. */}
      <Switch>
        <Match when={v.arrayFields.includes(props.field)}>
          <input
            type="text"
            id={id()}
            value={v.fieldValues[props.field] ?? ""}
            onInput={onInput}
            placeholder="Valeurs séparées par des virgules"
          />
        </Match>
        <Match when={props.field === "desc"}>
          <textarea
            id={id()}
            rows="4"
            value={v.fieldValues[props.field] ?? ""}
            onInput={onInput}
          />
        </Match>
        <Match when={true}>
          <input
            type="text"
            id={id()}
            value={v.fieldValues[props.field] ?? ""}
            onInput={onInput}
          />
        </Match>
      </Switch>
    </div>
  );
}
