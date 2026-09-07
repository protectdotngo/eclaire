import { For, Show } from "solid-js";
import VerifField from "./VerifField";
import { useVerification } from "./verificationContext";
import styles from "./Verification.module.css";

export default function DetailForm() {
  const v = useVerification();
  return (
    <Show when={v.active()}>
      {(active) => (
        <div>
          <div class={styles["detail-head"]}>
            <div>
              <h2>{v.fieldValues.name || "(sans nom)"}</h2>
              {/* .meta and .form-body have no CSS rules at all: kept as
                    literal classes so the DOM does not change. */}
              <p class="meta">
                <span>
                  {active().action === "modify"
                    ? "Modification d'une org existante"
                    : "Nouvelle organisation"}
                </span>
                <br />
                proposé par:&ensp;
                <span>{active().submitterEmail || "—"}</span>
                <Show when={active().adminEditor}>
                  <span>
                    {" · dernière édition : "}
                    <span>{active().adminEditor}</span>
                    <Show when={active().adminEditedAt}>
                      <span>
                        {" le " +
                          new Date(
                            active().adminEditedAt as string,
                          ).toLocaleString("fr-CH")}
                      </span>
                    </Show>
                  </span>
                </Show>
              </p>
            </div>
            <button
              type="button"
              class={styles.close}
              aria-label="Fermer"
              onClick={() => v.close()}
            >
              ✕
            </button>
          </div>

          <div class={styles["verdict-bar"]}>
            <span>
              Verdict automatique : <strong>{active().verdict || "n/a"}</strong>
            </span>
            <span>
              Score de légitimité :{" "}
              <strong>
                {active().legitimacyScore != null
                  ? active().legitimacyScore + "/10"
                  : "—"}
              </strong>
            </span>
            <Show when={active().notes}>
              <span class={styles.notes}>{active().notes}</span>
            </Show>
          </div>

          <div class="form-body">
            <For each={v.fieldOrder}>{(f) => <VerifField field={f} />}</For>

            <div classList={{ [styles.field]: true, [styles.admin]: true }}>
              <label for="f-admin">
                <span class={styles["lbl-text"]}>Ton email</span>
              </label>
              <input
                type="email"
                id="f-admin"
                value={v.adminEditor()}
                onInput={(e) => v.setAdminEditor(e.currentTarget.value)}
                placeholder="exemple@protect.ngo"
                required
              />
            </div>

            <div class={styles.actions}>
              <button
                type="button"
                class={styles.secondary}
                disabled={v.busy()}
                onClick={() => void v.submit("save")}
              >
                Enregistrer
              </button>
              <button
                type="button"
                disabled={v.busy()}
                onClick={() => void v.submit("publish")}
              >
                Publier
              </button>
              <button
                type="button"
                class={styles.danger}
                disabled={v.busy()}
                onClick={() => void v.submit("reject")}
              >
                Rejeter
              </button>
              <span
                classList={{
                  [styles.ok]: v.statusClass() === "ok",
                  [styles.error]: v.statusClass() === "error",
                }}
                role="status"
              >
                {v.status()}
              </span>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}
