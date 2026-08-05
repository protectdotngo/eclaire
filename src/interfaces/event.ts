import type { OrgReference } from "./org";

export interface Event {
  id: string;
  url: string | null;
  title: string | null;
  content: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  categories: string[] | null;
}

export interface EventWithOrgIds extends Event {
  org_ids: string[];
}

export interface EventWithOrgs extends Event {
  orgs: OrgReference[];
}
