export interface RawEvent {
  id: string;
  url: string | null;
  title: string | null;
  content: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  categories: string[] | null;
  org_ids: string[];
}

export interface ProcessedEvent {
  id: string;
  url: string | null;
  title: string;
  content: string;
  shortContent: string;
  location: string;
  categories: string[];
  org_ids: string[];
  startDate: Date;
  endDate: Date | null;
  startDay: string;
  startMonth: string;
  endDay: string;
  endMonth: string;
  hasEnd: boolean;
  timeLabel: string;
  monthKey: string;
  isPast: boolean;
}

export interface Org {
  id: string;
  name: string;
}
