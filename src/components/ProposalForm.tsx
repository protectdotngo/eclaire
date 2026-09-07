import { createMemo, createSignal, onMount, Show } from "solid-js";
import { createStore } from "solid-js/store";
import Hero from "./sections/general/Hero";
import SubmitterSection from "./sections/propose/SubmitterSection";
import OrgFieldsSection from "./sections/propose/OrgFieldsSection";
import {
  ProposalContext,
  type ProposalStore,
} from "./sections/propose/proposeContext";
import {
  buildProposalPayload,
  canSubmit as computeCanSubmit,
  EMPTY_FORM,
  fetchOrgs,
  orgFieldsReset,
  orgToFormFields,
  validate,
  type ArrayField,
  type ProposalFormData,
  type StringField,
} from "../lib/proposalFormState";
import type { Org } from "../interfaces/org";
import styles from "./ProposalForm.module.css";

export default function ProposalForm() {
  const [form, setForm] = createStore<ProposalFormData>({ ...EMPTY_FORM });
  const [allOrgs, setAllOrgs] = createSignal<readonly Org[]>([]);
  const [originalOrg, setOriginalOrg] = createSignal<Org | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");

  const canSubmit = createMemo(() => computeCanSubmit(form, originalOrg()));

  onMount(async () => {
    try {
      setAllOrgs(await fetchOrgs());
    } catch (err) {
      console.error("Failed to load orgs:", err);
    }
  });

  const store: ProposalStore = {
    form,
    setField: (k: StringField, v: string) => setForm(k, v),
    setArrayItem: (k: ArrayField, i: number, v: string) => setForm(k, i, v),
    pushArrayItem: (k: ArrayField) => setForm(k, (a) => [...a, ""]),
    removeArrayItem: (k: ArrayField, i: number) =>
      setForm(k, (a) => a.filter((_, j) => j !== i)),
    toggleCategory: (name: string) =>
      setForm("categories", (a) =>
        a.includes(name) ? a.filter((c) => c !== name) : [...a, name],
      ),
    toggleAudience: (name: string) =>
      setForm("audience", (a) =>
        a.includes(name) ? a.filter((c) => c !== name) : [...a, name],
      ),

    allOrgs,
    originalOrg,
    submitting,
    error,
    canSubmit,

    onActionChange() {
      setForm("modifying_org_id", "");
      setOriginalOrg(null);
      if (form.action === "propose") {
        setForm(orgFieldsReset());
      }
    },

    onOrgSelected() {
      const org = allOrgs().find((o) => o.id === form.modifying_org_id);
      if (!org) {
        setOriginalOrg(null);
        return;
      }
      setOriginalOrg({ ...org });
      setForm(orgToFormFields(org));
    },

    async submitForm() {
      const err = validate(form, originalOrg());
      if (err) {
        setError(err);
        return;
      }
      setError("");
      setSubmitting(true);
      try {
        const res = await fetch("/api/propose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildProposalPayload(form)),
        });
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        window.location.href = "/proposer/merci";
      } catch (err) {
        console.error("Failed to submit proposal:", err);
        setError("Une erreur est survenue. Merci de réessayer plus tard.");
        setSubmitting(false);
      }
    },
  };

  return (
    <ProposalContext.Provider value={store}>
      <section class={styles["proposal-page"]}>
        <Hero
          title="Proposer une organisation"
          body="Aide-nous à enrichir le calendrier en proposant une nouvelle organisation ou en suggérant une modification."
          image="/images/4.jpg"
          comp
        >
          <form
            class={styles["proposal-form"]}
            id="proposalForm"
            onSubmit={(e) => {
              e.preventDefault();
              void store.submitForm();
            }}
          >
            <SubmitterSection />
            <OrgFieldsSection />

            <div class={styles["proposal-actions"]}>
              <button
                type="submit"
                form="proposalForm"
                class={styles["proposal-submit"]}
                disabled={!canSubmit() || submitting()}
                title={
                  !canSubmit()
                    ? "Remplis tous les champs obligatoires pour continuer"
                    : ""
                }
              >
                <Show
                  when={!submitting()}
                  fallback={<span>Envoi en cours...</span>}
                >
                  <span>Envoyer</span>
                </Show>
              </button>
              <Show when={error()}>
                <p class={styles["proposal-error"]}>{error()}</p>
              </Show>
            </div>
          </form>
        </Hero>
      </section>
    </ProposalContext.Provider>
  );
}
