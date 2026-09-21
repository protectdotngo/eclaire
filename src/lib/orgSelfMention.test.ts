import { describe, expect, it } from "vitest";
import { buildersBlockFor, mentionsOwnOrg } from "./orgSelfMention";

describe("mentionsOwnOrg", () => {
  describe("positives — the user speaks as an organisation", () => {
    const speaksAsOrg = [
      "Notre association cherche une formation en cybersécurité",
      "nos associations ont besoin d'aide pour le RGPD",
      "Ma structure aimerait sensibiliser ses bénévoles",
      "Mon ONG a été victime d'un phishing",
      "Je travaille pour une association genevoise",
      "je bosse dans une ONG à Carouge",
      "Nous sommes une association de quartier",
      "On est une fondation, on veut protéger nos données",
      "Notre équipe n'est pas formée aux arnaques en ligne",
      "Je suis bénévole dans une association et je gère l'informatique",
      "Our nonprofit needs a security assessment",
      "I work for an NGO in Geneva",
      "we are a charity looking for IT training",
    ];

    for (const text of speaksAsOrg) {
      it(`matches: ${text}`, () => {
        expect(mentionsOwnOrg(text)).toBe(true);
      });
    }
  });

  describe("negatives — the user is looking for an organisation", () => {
    const looksForOrg = [
      "Je cherche une association pour ma mère",
      "Quelles associations aident les seniors avec leur ordinateur ?",
      "Y a-t-il une ONG qui donne des cours d'informatique à Genève ?",
      "Connais-tu des associations de quartier ?",
      "Je voudrais contacter une fondation",
      "Which associations offer smartphone workshops?",
      "Des ateliers pour apprendre à utiliser un smartphone",
      "",
    ];

    for (const text of looksForOrg) {
      it(`does not match: ${text || "(empty)"}`, () => {
        expect(mentionsOwnOrg(text)).toBe(false);
      });
    }
  });

  it("ignores accents and case", () => {
    expect(mentionsOwnOrg("NOTRE ASSOCIATION a besoin d'aide")).toBe(true);
    expect(mentionsOwnOrg("notre federation cherche un appui")).toBe(true);
  });
});

describe("buildersBlockFor", () => {
  const neutral = "Des ateliers smartphone à Carouge ?";

  it("emits a block when the model raised the flag", () => {
    expect(
      buildersBlockFor({ asksAsOrg: true, lastUserText: neutral, lang: "fr" }),
    ).toEqual({ type: "builders", lang: "fr" });
  });

  it("emits a block when the heuristic matches, flag or not", () => {
    expect(
      buildersBlockFor({
        asksAsOrg: false,
        lastUserText: "Notre association a besoin d'une formation",
        lang: "en",
      }),
    ).toEqual({ type: "builders", lang: "en" });
  });

  it("emits nothing when neither signal fires", () => {
    expect(
      buildersBlockFor({ asksAsOrg: false, lastUserText: neutral, lang: "fr" }),
    ).toBeNull();
  });

  it("tolerates a missing last user message", () => {
    expect(
      buildersBlockFor({
        asksAsOrg: false,
        lastUserText: undefined,
        lang: "fr",
      }),
    ).toBeNull();
  });
});
