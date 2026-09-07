import { For, Show } from "solid-js";
import FieldText from "./FieldText";
import FieldSelect from "./FieldSelect";
import { useProposalForm } from "./proposeContext";
import styles from "./SubmitterSection.module.css";

export default function SubmitterSection() {
  const f = useProposalForm();
  return (
    <div class={styles["proposal-section"]}>
      <h2 class={styles["proposal-section-title"]}>À propos de toi</h2>

      <FieldSelect
        name="submitter_type"
        label="Tu es"
        required
        value={f.form.submitter_type}
        onChange={(v) => f.setField("submitter_type", v)}
      >
        <option value="">Sélectionne...</option>
        <option value="organisation">Une organisation</option>
        <option value="particulier">Un particulier</option>
      </FieldSelect>

      <FieldSelect
        name="action"
        label="Tu souhaites"
        required
        value={f.form.action}
        onChange={(v) => {
          f.setField("action", v);
          f.onActionChange();
        }}
      >
        <option value="">Sélectionne...</option>
        <option value="propose">Proposer une nouvelle organisation</option>
        <option value="modify">Modifier une organisation existante</option>
      </FieldSelect>

      <Show when={f.form.action === "modify"}>
        <div class={styles["section-enter"]}>
          <FieldSelect
            name="modifying_org"
            label="Organisation à modifier"
            visualRequired
            value={f.form.modifying_org_id}
            onChange={(v) => {
              f.setField("modifying_org_id", v);
              f.onOrgSelected();
            }}
          >
            <option value="">Sélectionne une organisation...</option>
            <For each={f.allOrgs()}>
              {(org) => <option value={org.id}>{org.name}</option>}
            </For>
          </FieldSelect>
        </div>
      </Show>

      <FieldText
        name="submitter_name"
        label="Ton nom"
        required
        placeholder="Prénom et nom"
      />

      <FieldText
        name="submitter_email"
        label="Ton email"
        type="email"
        required
        placeholder="Pour te recontacter si besoin"
      />
    </div>
  );
}
