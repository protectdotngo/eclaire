export const AUDIENCE_TAGS = [
  "jeunesse",
  "seniors",
  "femmes",
  "personnes migrantes",
  "handicap",
  "emploi",
  "intergénérationnel",
  "tout public",
] as const;

export type AudienceTag = (typeof AUDIENCE_TAGS)[number];