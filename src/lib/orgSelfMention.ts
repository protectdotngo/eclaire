import type { BuildersBlock, ReplyLang } from "../interfaces/chat";

/**
 * Detects that the user is speaking *as* an organisation, not looking *for*
 * one (EC-41).
 *
 * The distinction is the whole difficulty: « notre association cherche une
 * formation » and « je cherche une association pour ma mère » share the same
 * noun, and only the second is the ordinary use of the directory. So a bare
 * keyword never matches — every pattern requires a possessive, a copula or a
 * first-person role alongside the noun.
 *
 * This is the deterministic backstop for the model's `asks_as_org` flag: the
 * production system prompt lives in the database (see chatPrompt.ts), so the
 * flag only starts arriving once the prompt is updated through /prompt, while
 * this heuristic works from the moment the code ships.
 */

/** Nouns for the organisation itself. */
const ORG = [
  "associations?",
  "assoc",
  "asso",
  "organisations?",
  "organismes?",
  "ong",
  "fondations?",
  "federations?",
  "cooperatives?",
  "collectifs?",
  "structures?",
  "institutions?",
  "clubs?",
  "comites?",
  "nonprofits?",
  "non-profits?",
  "ngos?",
  "charity",
  "charities",
].join("|");

/** Nouns for the people in it — « notre équipe », « our volunteers ». */
const TEAM = [
  "equipes?",
  "personnel",
  "staff",
  "benevoles",
  "salaries",
  "collaborat(?:eur|rice)s?",
  "membres",
  "adherents",
  "bureau",
  "team",
  "volunteers",
  "employees",
].join("|");

/** Roles someone holds *inside* an organisation. */
const ROLE = [
  "benevole",
  "salariee?",
  "employee?",
  "responsable",
  "presidente?",
  "direct(?:eur|rice)",
  "secretaire",
  "tresoriere?",
  "coordinat(?:eur|rice)",
].join("|");

const PATTERNS: readonly RegExp[] = [
  // « notre association », « ma structure », « our nonprofit », « my NGO »
  new RegExp(
    `\\b(?:notre|nos|ma|mon|mes|our|my)\\s+(?:(?:petite|propre|small|own)\\s+)?(?:${ORG}|${TEAM})\\b`,
  ),
  // « nous sommes une association », « on est une fondation », « we are a charity »
  new RegExp(
    `\\b(?:nous\\s+sommes|on\\s+est|we\\s+are|we're)\\s+(?:une?|an?|the)\\s+(?:(?:petite|small)\\s+)?(?:${ORG})\\b`,
  ),
  // « je travaille pour une ONG », « je suis bénévole dans une association »,
  // « I work for an NGO »
  new RegExp(
    `\\b(?:je\\s+(?:travaille|bosse)|je\\s+suis\\s+(?:${ROLE})|i\\s+work|i'm\\s+an?\\s+(?:${ROLE})|i\\s+volunteer)\\s+(?:pour|dans|au\\s+sein\\s+d|chez|for|at|with|in)\\b[^.?!]{0,40}?(?:${ORG})\\b`,
  ),
];

/** Lowercases and strips diacritics so one spelling of each pattern suffices. */
function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function mentionsOwnOrg(text: string): boolean {
  if (!text) return false;
  const normalized = normalize(text);
  return PATTERNS.some((re) => re.test(normalized));
}

/**
 * The EC-41 decision, kept pure so both signals are testable without a DB or
 * an LLM: the model's flag OR the heuristic above is enough.
 *
 * Returns the block to append, or null. Showing it at most once per
 * conversation is the client's job (see chatController), since the API route
 * is stateless.
 */
export function buildersBlockFor(input: {
  asksAsOrg: boolean;
  lastUserText: string | undefined;
  lang: ReplyLang;
}): BuildersBlock | null {
  const detected = input.asksAsOrg || mentionsOwnOrg(input.lastUserText ?? "");
  return detected ? { type: "builders", lang: input.lang } : null;
}
