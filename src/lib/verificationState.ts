import { ARRAY_FIELDS, ORG_FIELDS } from "../interfaces/verification";
import type { Detail, ListItem } from "../interfaces/verification";

export const FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  desc: "Description",
  categories: "Catégories",
  domain: "Site web",
  address: "Adresse",
  city: "Ville",
  rss: "Flux RSS",
  events_url: "URL des événements",
  news_url: "URL des actualités",
  socials: "Réseaux sociaux",
  contact: "Contact",
};

export const HELP_GREEN =
  "La vérification automatique n'a rien trouvé de suspect sur ce champ. Il ne devrait pas y avoir de problème à conserver la valeur. Au besoin, une petite recherche de confirmation reste la meilleure option.";
export const HELP_RED =
  "La vérification automatique a signalé ce champ comme suspect. Il est vivement recommandé de vérifier soigneusement cette information avant de publier.";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A field's verification state. Used to be typed `string`. */
export type FieldState = "" | "green" | "red";

/** Status class applied after an action. Used to be typed `string`. */
export type StatusClass = "" | "ok" | "error";

export type SubmitMode = "save" | "publish" | "reject";

export function fieldStateFor(
  active: Detail | null,
  field: string,
): FieldState {
  if (!active) return "";
  if (active.suspiciousChanges?.includes(field)) return "red";
  if (active.confirmedByWeb?.includes(field)) return "green";
  return "";
}

export function helpTextFor(state: FieldState): string {
  return state === "red" ? HELP_RED : HELP_GREEN;
}

/** Flattens a detail's values into editable form fields. */
export function detailToFieldValues(detail: Detail): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of ORG_FIELDS) {
    const val = detail.values[f];
    out[f] = Array.isArray(val) ? val.join(", ") : (val ?? "");
  }
  return out;
}

/** Splits array fields back apart on commas before sending. */
export function collectFields(
  fieldValues: Record<string, string>,
): Record<string, string[] | string> {
  const out: Record<string, string[] | string> = {};
  for (const f of ORG_FIELDS) {
    const raw = fieldValues[f] ?? "";
    if (ARRAY_FIELDS.includes(f)) {
      out[f] = raw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    } else {
      out[f] = raw;
    }
  }
  return out;
}

export function buildWritePayload(
  mode: SubmitMode,
  verificationId: string,
  adminEditor: string,
  fieldValues: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { verificationId, adminEditor };
  if (mode === "publish") payload.publish = true;
  if (mode === "reject") payload.reject = true;
  if (mode !== "reject") payload.fields = collectFields(fieldValues);
  return payload;
}

export function pendingStatusFor(mode: SubmitMode): string {
  return mode === "publish"
    ? "Publication…"
    : mode === "reject"
      ? "Rejet…"
      : "Enregistrement…";
}

export function doneStatusFor(mode: SubmitMode, changed: unknown): string {
  if (mode === "reject") return "Rejeté ✓";
  return changed === 0 ? "Publié ✓ (aucun champ modifié)" : "Publié ✓";
}

export function confirmMessageFor(mode: SubmitMode): string | null {
  if (mode === "publish") return "Publier cette proposition dans la base ?";
  if (mode === "reject")
    return "Rejeter cette proposition ? Elle ne sera pas publiée.";
  return null;
}

/** Tooltip position, computed from the "?" button's bounding rect. */
export function tipPositionFor(el: HTMLElement): { top: number; left: number } {
  const r = el.getBoundingClientRect();
  return {
    top: window.scrollY + r.bottom + 6,
    left: Math.min(
      window.scrollX + r.left,
      window.scrollX + window.innerWidth - 320,
    ),
  };
}

export async function fetchList(): Promise<ListItem[]> {
  const res = await fetch("/api/verifications");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
  return data.items as ListItem[];
}

export async function fetchDetail(id: string): Promise<Detail> {
  const res = await fetch(`/api/verifications?id=${encodeURIComponent(id)}`);
  const data = (await res.json()) as Detail & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
  return data;
}
