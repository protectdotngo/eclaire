export interface Data {
  id: string;
  name: string;
  desc: string;
  address: string;
  city: string;
  domain: string;
  categories: string[];
  socials: string[];
  lat: number;
  lon: number;
  reason?: string;
}
