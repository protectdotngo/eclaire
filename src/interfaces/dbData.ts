import type { News } from "./dbNews";
import type { Event } from "./dbEvent";

export interface Data {
  name: string;
  desc: string;
  address: string;
  city: string;
  domain: string;
  categories: string[];
  socials: string[];
  lat: number;
  lon: number;
  topNews: News[];
  topEvents: Event[];
}
