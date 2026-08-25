// Deterministic preselection of candidate organizations for a question, injected
// into the system prompt to guide the LLM's attention (the complete directory
// is still provided: if a match is missed ⇒ behavior is identical to before, never worse).

import type { OrgLite, Candidate } from "../interfaces/org";

// lowercase + remove accents + punctuation → spaces
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Bounded Levenshtein distance (early exit when exceeded)
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// word in the question ≈ vocabulary term? (tolerates typos)
function fuzzyMatch(word: string, term: string): boolean {
  if (word.includes(term) || term.includes(word)) return true;
  if (word.length < 4 || term.length < 4) return false;
  const len = Math.min(word.length, term.length);
  const tol = len >= 6 ? 2 : 1;
  return editDistance(word, term, tol) <= tol;
}

// Thematic groups: if a "trigger" appears in the question, we also search
// for the "terms" in the descriptions. Everything is written WITHOUT accents (post-normalized).
// To add a missing association: add the word from the description to the terms.
const SYNONYM_GROUPS: Array<{ triggers: string[]; terms: string[] }> = [
  {
    triggers: [
      "harcel",
      "harcele",
      "cyberharcel",
      "haine",
      "insulte",
      "menace",
      "victime",
      "cyberviolence",
      "intimidation",
    ],
    terms: [
      "harcel",
      "haine",
      "cyberviolence",
      "violence",
      "victime",
      "protection",
      "moderation",
      "prevention",
      "cybercriminalite",
    ],
  },
  {
    triggers: [
      "arnaque",
      "phishing",
      "hameconnage",
      "fraude",
      "escroquerie",
      "pirate",
      "piratage",
      "vole",
      "usurpation",
    ],
    terms: [
      "arnaque",
      "phishing",
      "hameconnage",
      "fraude",
      "escroquer",
      "pirat",
      "cybersecurite",
      "securite",
      "prevention",
      "cybercriminalite",
    ],
  },
  {
    triggers: [
      "securite",
      "cybersecurite",
      "proteger",
      "protection",
      "mot de passe",
    ],
    terms: ["cybersecurite", "securite", "protection", "prevention"],
  },
  {
    triggers: [
      "senior",
      "age",
      "retraite",
      "grand pere",
      "grand mere",
      "vieux",
    ],
    terms: ["senior", "aine", "age", "retraite", "intergenerationnel"],
  },
  {
    triggers: ["emploi", "travail", "chomage", "cv", "postuler"],
    terms: ["emploi", "professionnel", "insertion", "chomage"],
  },
  {
    triggers: ["migrant", "refugie", "asile", "etranger"],
    terms: ["migrant", "migration", "refugie", "asile", "accueil"],
  },
  {
    triggers: ["handicap", "malvoyant", "sourd", "accessibilite"],
    terms: ["handicap", "accessibilite", "inclusion"],
  },
];

const STOP_WORDS = new Set(
  "je tu il elle nous vous ils elles suis es est sommes etes sont un une des les le la de du au aux et ou mais donc car ne pas plus tres que qui quoi dont comment pourquoi quand faire peux peut puis pour avec sans dans sur sous mon ma mes ton ta tes son sa ses ce cette ces cela ca en ligne y a on se me te lui leur quel quelle quels quelles est-ce qu il".split(
    /\s+/,
  ),
);

export function selectCandidates(
  question: string,
  orgs: OrgLite[],
  limit = 8,
): Candidate[] {
  const words = normalize(question)
    .split(" ")
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  if (words.length === 0) return [];

  // search terms = words from the question + related topics
  const terms = new Set(words);
  for (const group of SYNONYM_GROUPS) {
    if (words.some((w) => group.triggers.some((t) => fuzzyMatch(w, t)))) {
      for (const t of group.terms) terms.add(t);
    }
  }

  const scored: Candidate[] = [];
  for (const org of orgs) {
    const desc = normalize(org.desc ?? "");
    const name = normalize(org.name ?? "");
    const cats = normalize((org.categories ?? []).join(" "));
    let score = 0;
    for (const t of terms) {
      if (desc.includes(t)) score += 1;
      if (cats.includes(t)) score += 1;
      if (name.includes(t)) score += 2;
    }
    if (score > 0) scored.push({ id: org.id, name: org.name, score });
  }

  const ranked = scored.sort((a, b) => b.score - a.score).slice(0, limit);
  // If even the best score is 1, it's all lexical noise (words that are too
  // generic) → no candidates section, same behavior as before
  if (ranked.length === 0 || ranked[0].score < 2) return [];
  return ranked;
}

export function candidatesPromptSection(candidates: Candidate[]): string {
  if (candidates.length === 0) return "";
  const lines = candidates.map((c) => `- ${c.id} — ${c.name}`).join("\n");
  return `\n# CANDIDATS PRIORITAIRES POUR CETTE QUESTION\n\nCes organisations de l'annuaire correspondent le mieux aux mots de la dernière question (pré-sélection automatique par mots-clés). Examine leurs desc EN PREMIER pour ta sélection — mais applique ensuite les règles de pertinence normales : vérifie chaque desc, écarte celles qui ne correspondent pas vraiment, et tu peux toujours retenir une org hors de cette liste si son desc correspond mieux.\n\n${lines}\n`;
}
