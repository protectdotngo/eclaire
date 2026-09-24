import type { ReplyLang } from "../interfaces/chat";

export const BUILDERS_URL = "https://protect.ngo/ge";

export interface BuildersCopy {
  /** Short label above the title, like the ÉVÉNEMENT tag on event cards. */
  tag: string;
  title: string;
  body: string;
  cta: string;
}

/**
 * Copy for the Builders card (EC-41), one entry per language the assistant is
 * allowed to answer in.
 *
 * Written here and never by the model — same rule as the canned scope redirect
 * in chatValidation.ts. The assistant uses «tu» in French, so this card does
 * too; the brand keeps its English name everywhere except the French copy,
 * where «les Builders» reads better.
 */
export const BUILDERS_COPY: Record<ReplyLang, BuildersCopy> = {
  fr: {
    tag: "POUR LES ORGANISATIONS / ASSOCIATIONS",
    title: "Tu représentes une organisation ou une association ?",
    body: "Les Builders de Protect.ngo mettent gratuitement des expert·es en cybersécurité bénévoles à disposition des organisations à but non lucratif : évaluation de sécurité, scan de vulnérabilités, sensibilisation des équipes, plan de réponse aux incidents.",
    cta: "Découvrir les Builders",
  },
  en: {
    tag: "FOR NONPROFITS",
    title: "Are you part of a nonprofit?",
    body: "The Builders connect nonprofits with volunteer cybersecurity experts, free of charge: security assessments, vulnerability scanning, staff awareness, incident response planning.",
    cta: "Discover The Builders",
  },
  de: {
    tag: "FÜR ORGANISATIONEN",
    title: "Vertrittst du eine Organisation?",
    body: "The Builders vermitteln gemeinnützigen Organisationen kostenlos freiwillige Cybersicherheits-Fachleute: Sicherheitsbewertungen, Schwachstellen-Scans, Sensibilisierung der Teams, Notfallplanung.",
    cta: "The Builders entdecken",
  },
  it: {
    tag: "PER LE ASSOCIAZIONI",
    title: "Rappresenti un'associazione?",
    body: "The Builders mettono gratuitamente a disposizione delle organizzazioni senza scopo di lucro esperti di cybersicurezza volontari: valutazioni di sicurezza, scansione delle vulnerabilità, sensibilizzazione dei team, piani di risposta agli incidenti.",
    cta: "Scopri The Builders",
  },
  es: {
    tag: "PARA LAS ASOCIACIONES",
    title: "¿Representas a una asociación?",
    body: "The Builders ponen gratuitamente a disposición de las organizaciones sin ánimo de lucro a personas expertas voluntarias en ciberseguridad: evaluaciones de seguridad, análisis de vulnerabilidades, sensibilización de los equipos, planes de respuesta a incidentes.",
    cta: "Descubrir The Builders",
  },
};
