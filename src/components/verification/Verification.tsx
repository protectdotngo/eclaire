import { createSignal, For, onMount, Show } from "solid-js";
import { createStore } from "solid-js/store";
import VerifCard from "./VerifCard";
import DetailForm from "./DetailForm";
import Tooltip from "./Tooltip";
import {
  VerificationContext,
  type VerificationStore,
} from "./verificationContext";
import { ARRAY_FIELDS, ORG_FIELDS } from "../../interfaces/verification";
import type { Detail, ListItem } from "../../interfaces/verification";
import {
  buildWritePayload,
  confirmMessageFor,
  detailToFieldValues,
  doneStatusFor,
  EMAIL_RE,
  FIELD_LABELS,
  fetchDetail,
  fetchList,
  fieldStateFor,
  helpTextFor,
  pendingStatusFor,
  tipPositionFor,
  type StatusClass,
  type SubmitMode,
} from "../../lib/verificationState";
import styles from "./Verification.module.css";

export default function Verification() {
  const [items, setItems] = createSignal<readonly ListItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [listError, setListError] = createSignal("");
  const [active, setActive] = createSignal<Detail | null>(null);
  const [activeId, setActiveId] = createSignal("");
  const [fieldValues, setFieldValues] = createStore<Record<string, string>>({});
  const [adminEditor, setAdminEditor] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [status, setStatus] = createSignal("");
  const [statusClass, setStatusClass] = createSignal<StatusClass>("");
  const [tip, setTip] = createSignal({ text: "", top: 0, left: 0 });

  let detailRef: HTMLElement | undefined;

  onMount(async () => {
    try {
      setItems(await fetchList());
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  });

  const store: VerificationStore = {
    items,
    loading,
    listError,
    active,
    activeId,
    fieldValues,
    setFieldValue: (field, value) => setFieldValues(field, value),
    adminEditor,
    setAdminEditor,
    busy,
    status,
    statusClass,
    tip,

    showTip(ev, field) {
      const state = fieldStateFor(active(), field);
      if (!state) return;
      const el = ev.currentTarget as HTMLElement | null;
      if (!el) return;
      setTip({ text: helpTextFor(state), ...tipPositionFor(el) });
    },
    hideTip() {
      setTip({ text: "", top: 0, left: 0 });
    },

    fieldOrder: ORG_FIELDS,
    arrayFields: ARRAY_FIELDS,
    fieldLabels: FIELD_LABELS,
    fieldState: (field) => fieldStateFor(active(), field),

    async open(id) {
      setActiveId(id);
      setStatus("");
      setStatusClass("");
      try {
        const detail = await fetchDetail(id);
        setActive(detail);
        setFieldValues(detailToFieldValues(detail));
        if (!adminEditor() && detail.adminEditor) {
          setAdminEditor(detail.adminEditor);
        }
        // Etait $nextTick + $root.querySelector(".detail") : une ref survit au
        // hachage des classes par les CSS Modules, et Solid applique les
        // ecritures de signal de façon synchrone, donc la ref est deja a jour.
        detailRef?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Échec du chargement");
        setStatusClass("error");
      }
    },

    close() {
      setActive(null);
      setActiveId("");
      store.hideTip();
    },

    async submit(mode: SubmitMode) {
      const current = active();
      if (!current) return;
      const email = adminEditor().trim();
      if (!EMAIL_RE.test(email)) {
        setStatus("Renseigne un email valide avant de continuer.");
        setStatusClass("error");
        return;
      }
      const confirmMessage = confirmMessageFor(mode);
      if (confirmMessage && !confirm(confirmMessage)) return;

      setBusy(true);
      setStatus(pendingStatusFor(mode));
      setStatusClass("");
      try {
        const res = await fetch("/api/verifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildWritePayload(mode, current.verificationId, email, fieldValues),
          ),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);

        if (mode === "save") {
          setStatus("Enregistré ✓");
          setStatusClass("ok");
          return;
        }

        setStatus(doneStatusFor(mode, data.changed));
        setStatusClass("ok");
        const doneId = current.verificationId;
        setTimeout(() => {
          setItems((list) => list.filter((it) => it.verificationId !== doneId));
          store.close();
        }, 900);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Échec de l'opération");
        setStatusClass("error");
      } finally {
        setBusy(false);
      }
    },

    registerDetailRef(el) {
      detailRef = el;
    },
  };

  return (
    <VerificationContext.Provider value={store}>
      <div class={styles.verif}>
        <div>
          <h1>Propositions vérifiées</h1>
          <p>
            Chaque proposition ci-dessous a été contrôlée automatiquement et n'a
            pas été rejetée. Clique sur une carte pour examiner, corriger puis
            publier. Les libellés{" "}
            <span class={styles["lg-green"]}>en vert</span> ont été confirmés
            par la vérification automatique ; ceux{" "}
            <span class={styles["lg-red"]}>en rouge</span> ont été signalés
            comme suspects.
          </p>
        </div>

        <div
          classList={{
            [styles.layout]: true,
            [styles["detail-open"]]: !!active(),
          }}
        >
          <section class={styles.list} aria-label="Liste des propositions">
            <Show when={loading()}>
              <p class={styles.empty}>Chargement…</p>
            </Show>
            <Show when={listError()}>
              <p class={styles.empty}>{listError()}</p>
            </Show>
            <Show when={!loading() && !listError() && items().length === 0}>
              <p class={styles.empty}>
                Aucune proposition à examiner pour le moment.
              </p>
            </Show>

            <Show when={items().length > 0}>
              <p class={styles["list-count"]}>
                <span>{items().length}</span>
                <span>
                  {items().length > 1 ? " propositions" : " proposition"}
                </span>
              </p>
            </Show>

            <div class={styles.cards}>
              <For each={items()}>
                {(it, i) => <VerifCard item={it} index={i()} />}
              </For>
            </div>
          </section>

          {/* x-cloak disparait : l'ile est rendue au SSR avec active=null,
              donc <Show> ne rend rien — il n'y a plus de flash a masquer. */}
          <Show when={active()}>
            <section
              class={styles.detail}
              ref={(el) => store.registerDetailRef(el)}
            >
              <DetailForm />
            </section>
          </Show>
        </div>

        <Tooltip />
      </div>
    </VerificationContext.Provider>
  );
}
