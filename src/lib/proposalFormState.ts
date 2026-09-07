import type { Org } from "../interfaces/org";

export const EMPTY_FORM = {
  submitter_type: "",
  action: "",
  modifying_org_id: "",
  submitter_name: "",
  submitter_email: "",
  name: "",
  desc: "",
  categories: [] as string[],
  audience: [] as string[],
  domain: "",
  address: "",
  city: "",
  rss: "",
  events_url: "",
  news_url: "",
  socials: [] as string[],
  contact: [] as string[],
};

export type ProposalFormData = typeof EMPTY_FORM;

/**
 * The string-valued and array-valued fields of `formData`.
 *
 * This is what replaces the Alpine expressions built by concatenation
 * (`x-model={"formData." + name}`): `name` becomes a compile-checked key, and
 * `astro check` finally validates those bindings.
 */
export type StringField = {
  [K in keyof ProposalFormData]: ProposalFormData[K] extends string ? K : never;
}[keyof ProposalFormData];

export type ArrayField = {
  [K in keyof ProposalFormData]: ProposalFormData[K] extends string[]
    ? K
    : never;
}[keyof ProposalFormData];

const AUDIENCE_SET = new Set([
  "seniors",
  "jeunesse",
  "femmes",
  "personnes migrantes",
  "handicap",
  "emploi",
  "intergénérationnel",
  "tout public",
  "adultes",
  "à domicile",
]);

/** Organisation fields cleared when switching back to "propose" mode. */
const ORG_FIELD_RESET: Partial<ProposalFormData> = {
  name: "",
  desc: "",
  categories: [],
  audience: [],
  domain: "",
  address: "",
  city: "",
  rss: "",
  events_url: "",
  news_url: "",
  socials: [],
  contact: [],
};

export function orgFieldsReset(): Partial<ProposalFormData> {
  return {
    ...ORG_FIELD_RESET,
    categories: [],
    audience: [],
    socials: [],
    contact: [],
  };
}

/** Splits an org's categories into thematic tags and target audiences. */
export function splitOrgCategories(categories: string[]): {
  thematic: string[];
  audience: string[];
} {
  const audience: string[] = [];
  const thematic: string[] = [];
  for (const cat of categories) {
    if (AUDIENCE_SET.has(cat)) {
      audience.push(cat);
    } else {
      thematic.push(cat);
    }
  }
  return { thematic, audience };
}

/** Values to apply when an org is selected for modification. */
export function orgToFormFields(org: Org): Partial<ProposalFormData> {
  const { thematic, audience } = splitOrgCategories(org.categories);
  return {
    name: org.name,
    desc: org.desc,
    categories: thematic,
    audience,
    domain: org.domain,
    address: org.address,
    city: org.city,
    rss: org.rss ?? "",
    events_url: org.events_url ?? "",
    news_url: org.news_url ?? "",
    socials: [...org.socials],
    contact: [...org.contact],
  };
}

export function hasChanges(
  form: ProposalFormData,
  originalOrg: Org | null,
): boolean {
  if (form.action !== "modify" || !originalOrg) return true;
  const orig = originalOrg;
  const currentCategories = [...form.categories, ...form.audience].sort();
  const origCategories = [...orig.categories].sort();
  if (form.name !== orig.name) return true;
  if (form.desc !== orig.desc) return true;
  if (JSON.stringify(currentCategories) !== JSON.stringify(origCategories))
    return true;
  if (form.domain !== orig.domain) return true;
  if (form.address !== orig.address) return true;
  if (form.city !== orig.city) return true;
  if ((form.rss || null) !== orig.rss) return true;
  if ((form.events_url || null) !== orig.events_url) return true;
  if ((form.news_url || null) !== orig.news_url) return true;
  if (
    JSON.stringify(form.socials.filter((s) => s).sort()) !==
    JSON.stringify(orig.socials.slice().sort())
  )
    return true;
  if (
    JSON.stringify(form.contact.filter((s) => s).sort()) !==
    JSON.stringify((orig.contact ?? []).slice().sort())
  )
    return true;
  return false;
}

export function validate(
  form: ProposalFormData,
  originalOrg: Org | null,
): string {
  if (!form.submitter_type)
    return "Merci de préciser si tu es une organisation ou un particulier.";
  if (!form.action) return "Merci d'indiquer ce que tu souhaites faire.";
  if (form.action === "modify" && !form.modifying_org_id)
    return "Merci de sélectionner l'organisation à modifier.";
  if (!form.submitter_name.trim()) return "Merci d'indiquer ton nom.";
  if (!form.submitter_email.trim()) return "Merci d'indiquer ton email.";
  if (!form.name.trim()) return "Le nom de l'organisation est requis.";
  if (!form.desc.trim()) return "La description est requise.";
  if (form.categories.length === 0)
    return "Sélectionne au moins une catégorie thématique.";
  if (!form.domain.trim()) return "Le site web est requis.";
  if (form.action === "modify" && !hasChanges(form, originalOrg)) {
    return "Aucune modification n'a été apportée. Modifie au moins un champ pour soumettre.";
  }
  return "";
}

export function canSubmit(
  form: ProposalFormData,
  originalOrg: Org | null,
): boolean {
  if (!form.submitter_type) return false;
  if (!form.action) return false;
  if (!form.submitter_name.trim()) return false;
  if (!form.submitter_email.trim()) return false;
  if (form.action === "modify" && !form.modifying_org_id) return false;
  if (!form.name.trim()) return false;
  if (!form.desc.trim()) return false;
  if (form.categories.length === 0) return false;
  if (!form.domain.trim()) return false;
  if (form.action === "modify" && !hasChanges(form, originalOrg)) return false;
  return true;
}

export function buildProposalPayload(form: ProposalFormData) {
  return {
    submitter_type: form.submitter_type,
    action: form.action,
    modifying_org_id: form.modifying_org_id || null,
    submitter_name: form.submitter_name,
    submitter_email: form.submitter_email,
    name: form.name,
    desc: form.desc,
    categories: [...form.categories, ...form.audience],
    domain: form.domain,
    address: form.address,
    city: form.city,
    rss: form.rss || null,
    events_url: form.events_url || null,
    news_url: form.news_url || null,
    socials: form.socials.filter((s) => s.trim() !== ""),
    contact: form.contact.filter((s) => s.trim() !== ""),
  };
}

/** Loads and normalises the organisation list (GET /api/dataInit). */
export async function fetchOrgs(): Promise<Org[]> {
  const res = await fetch("/api/dataInit");
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
  const baseData = await res.json();
  return (baseData.data ?? [])
    .map((o: Org) => ({
      id: o.id,
      name: o.name,
      desc: o.desc ?? "",
      categories: o.categories ?? [],
      domain: o.domain ?? "",
      address: o.address ?? "",
      city: o.city ?? "",
      rss: o.rss ?? null,
      events_url: o.events_url ?? null,
      news_url: o.news_url ?? null,
      socials: o.socials ?? [],
      contact: o.contact ?? [],
    }))
    .sort((a: Org, b: Org) => a.name.localeCompare(b.name, "fr"));
}
