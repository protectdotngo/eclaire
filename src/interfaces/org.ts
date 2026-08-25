export interface Org {
  id: string;
  name: string;
  desc: string;
  categories: string[];
  domain: string;
  address: string;
  city: string;
  lat: number;
  lon: number;
  rss: string | null;
  events_url: string | null;
  news_url: string | null;
  socials: string[];
  contact: string[];
}

export interface UpcomingEvent {
  id: string;
  title: string;
  url: string | null;
}

export interface OrgWithChatContext extends Org {
  reason?: string;
  upcomingEvent?: {
    id: string;
    title: string;
    url: string | null;
  } | null;
}

export type OrgSummary = Pick<Org, "id" | "name">;

export interface OrgReference {
  id: string;
  name: string;
  domain: string | null;
}

export interface Candidate {
  id: string;
  name: string;
  score: number;
}

export interface OrgLite {
  id: string;
  name: string;
  desc: string;
  categories: string[] | null;
  city: string | null;
}
