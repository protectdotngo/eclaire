export const ORG_FIELDS = [
  "name",
  "desc",
  "categories",
  "domain",
  "address",
  "city",
  "rss",
  "events_url",
  "news_url",
  "socials",
  "contact",
] as const;

export type OrgField = (typeof ORG_FIELDS)[number];

export const ARRAY_FIELDS: readonly OrgField[] = [
  "categories",
  "socials",
  "contact",
];

export interface VerificationListItem {
  verificationId: string;
  propositionId: string;
  action: string | null;
  modifyingOrgId: string | null;
  orgName: string | null;
  submitterEmail: string | null;
  legitimacyScore: string | null;
  verdict: string | null;
  processingStatus: string;
  status: string;
  createdAt: string;
}

export interface VerificationDetail {
  verificationId: string;
  verdict: string | null;
  legitimacyScore: string | null;
  notes: string | null;
  confirmedByWeb: string[];
  suspiciousChanges: string[];

  propositionId: string;
  action: string | null;
  modifyingOrgId: string | null;
  status: string;
  submitterName: string | null;
  submitterEmail: string | null;
  adminEditor: string | null;
  adminEditedAt: string | null;

  values: Record<OrgField, string[] | string | null>;
  original: Record<string, unknown> | null;
}

export interface Detail {
  verificationId: string;
  verdict: string | null;
  legitimacyScore: string | null;
  notes: string | null;
  confirmedByWeb: string[];
  suspiciousChanges: string[];
  action: string | null;
  modifyingOrgId: string | null;
  submitterEmail: string | null;
  adminEditor: string | null;
  adminEditedAt: string | null;
  values: Record<string, string[] | string | null>;
}

export interface ListItem {
  verificationId: string;
  orgName: string | null;
  action: string | null;
  verdict: string | null;
  legitimacyScore: string | null;
  submitterEmail: string | null;
}

export interface WritePayload {
  verificationId?: unknown;
  adminEditor?: unknown;
  publish?: unknown;
  reject?: unknown;
  fields?: unknown;
}
