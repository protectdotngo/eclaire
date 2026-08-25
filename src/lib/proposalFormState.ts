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

export function createProposalForm() {
  return {
    formData: { ...EMPTY_FORM },
    allOrgs: [] as Org[],
    originalOrg: null as Org | null,
    submitting: false,
    error: "",

    async init() {
      try {
        const res = await fetch("/api/dataInit");
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        const baseData = await res.json();
        this.allOrgs = (baseData.data ?? [])
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
      } catch (err) {
        console.error("Failed to load orgs:", err);
      }
    },

    onActionChange() {
      this.formData.modifying_org_id = "";
      this.originalOrg = null;
      if (this.formData.action === "propose") {
        this.resetOrgFields();
      }
    },

    onOrgSelected() {
      const org = this.allOrgs.find(
        (o) => o.id === this.formData.modifying_org_id,
      );
      if (!org) {
        this.originalOrg = null;
        return;
      }
      this.originalOrg = { ...org };

      const audienceTags: string[] = [];
      const thematicTags: string[] = [];
      for (const cat of org.categories) {
        if (AUDIENCE_SET.has(cat)) {
          audienceTags.push(cat);
        } else {
          thematicTags.push(cat);
        }
      }

      this.formData.name = org.name;
      this.formData.desc = org.desc;
      this.formData.categories = thematicTags;
      this.formData.audience = audienceTags;
      this.formData.domain = org.domain;
      this.formData.address = org.address;
      this.formData.city = org.city;
      this.formData.rss = org.rss ?? "";
      this.formData.events_url = org.events_url ?? "";
      this.formData.news_url = org.news_url ?? "";
      this.formData.socials = [...org.socials];
      this.formData.contact = [...org.contact];
    },

    resetOrgFields() {
      this.formData.name = "";
      this.formData.desc = "";
      this.formData.categories = [];
      this.formData.audience = [];
      this.formData.domain = "";
      this.formData.address = "";
      this.formData.city = "";
      this.formData.rss = "";
      this.formData.events_url = "";
      this.formData.news_url = "";
      this.formData.socials = [];
      this.formData.contact = [];
    },

    toggleCategory(name: string) {
      const idx = this.formData.categories.indexOf(name);
      if (idx === -1) {
        this.formData.categories.push(name);
      } else {
        this.formData.categories.splice(idx, 1);
      }
    },

    toggleAudience(name: string) {
      const idx = this.formData.audience.indexOf(name);
      if (idx === -1) {
        this.formData.audience.push(name);
      } else {
        this.formData.audience.splice(idx, 1);
      }
    },

    hasChanges(): boolean {
      if (this.formData.action !== "modify" || !this.originalOrg) return true;
      const orig = this.originalOrg;
      const f = this.formData;
      const currentCategories = [...f.categories, ...f.audience].sort();
      const origCategories = [...orig.categories].sort();
      if (f.name !== orig.name) return true;
      if (f.desc !== orig.desc) return true;
      if (JSON.stringify(currentCategories) !== JSON.stringify(origCategories))
        return true;
      if (f.domain !== orig.domain) return true;
      if (f.address !== orig.address) return true;
      if (f.city !== orig.city) return true;
      if ((f.rss || null) !== orig.rss) return true;
      if ((f.events_url || null) !== orig.events_url) return true;
      if ((f.news_url || null) !== orig.news_url) return true;
      if (
        JSON.stringify(f.socials.filter((s) => s).sort()) !==
        JSON.stringify(orig.socials.slice().sort())
      )
        return true;
      if (
        JSON.stringify(f.contact.filter((s) => s).sort()) !==
        JSON.stringify((orig.contact ?? []).slice().sort())
      )
        return true;
      return false;
    },

    validate(): string {
      const f = this.formData;
      if (!f.submitter_type)
        return "Merci de préciser si tu es une organisation ou un particulier.";
      if (!f.action) return "Merci d'indiquer ce que tu souhaites faire.";
      if (f.action === "modify" && !f.modifying_org_id)
        return "Merci de sélectionner l'organisation à modifier.";
      if (!f.submitter_name.trim()) return "Merci d'indiquer ton nom.";
      if (!f.submitter_email.trim()) return "Merci d'indiquer ton email.";
      if (!f.name.trim()) return "Le nom de l'organisation est requis.";
      if (!f.desc.trim()) return "La description est requise.";
      if (f.categories.length === 0)
        return "Sélectionne au moins une catégorie thématique.";
      if (!f.domain.trim()) return "Le site web est requis.";
      if (f.action === "modify" && !this.hasChanges()) {
        return "Aucune modification n'a été apportée. Modifie au moins un champ pour soumettre.";
      }
      return "";
    },

    get canSubmit(): boolean {
      const f = this.formData;

      if (!f.submitter_type) return false;
      if (!f.action) return false;
      if (!f.submitter_name.trim()) return false;
      if (!f.submitter_email.trim()) return false;

      if (f.action === "modify" && !f.modifying_org_id) return false;

      if (!f.name.trim()) return false;
      if (!f.desc.trim()) return false;
      if (f.categories.length === 0) return false;
      if (!f.domain.trim()) return false;

      if (f.action === "modify" && !this.hasChanges()) return false;

      return true;
    },

    async submitForm() {
      const err = this.validate();
      if (err) {
        this.error = err;
        return;
      }
      this.error = "";
      this.submitting = true;

      const mergedCategories = [
        ...this.formData.categories,
        ...this.formData.audience,
      ];

      const payload = {
        submitter_type: this.formData.submitter_type,
        action: this.formData.action,
        modifying_org_id: this.formData.modifying_org_id || null,
        submitter_name: this.formData.submitter_name,
        submitter_email: this.formData.submitter_email,
        name: this.formData.name,
        desc: this.formData.desc,
        categories: mergedCategories,
        domain: this.formData.domain,
        address: this.formData.address,
        city: this.formData.city,
        rss: this.formData.rss || null,
        events_url: this.formData.events_url || null,
        news_url: this.formData.news_url || null,
        socials: this.formData.socials.filter((s: string) => s.trim() !== ""),
        contact: this.formData.contact.filter((s: string) => s.trim() !== ""),
      };

      try {
        const res = await fetch("/api/propose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        window.location.href = "/proposer/merci";
      } catch (err) {
        console.error("Failed to submit proposal:", err);
        this.error = "Une erreur est survenue. Merci de réessayer plus tard.";
        this.submitting = false;
      }
    },
  };
}
