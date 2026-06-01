import type { DisplayBucket } from "../interfaces/displayBucket";

export const DISPLAY_BUCKETS: DisplayBucket[] = [
  {
    calendarId: 'digital_learning',
    label: 'Apprentissage numérique',
    categories: ['formation numérique', 'inclusion & accessibilité numérique'],
    colors: {
      light: { main: '#1e6fdb', container: '#d4e4fb', onContainer: '#0a2d5e' },
      dark:  { main: '#7eb3f7', container: '#1a3a6b', onContainer: '#d4e4fb' },
    },
  },
  {
    calendarId: 'digital_help',
    label: 'Aide numérique',
    categories: ['aide & soutien numérique', 'connectivité publique', 'aide matérielle & équipement'],
    colors: {
      light: { main: '#0c8a5b', container: '#cdf0df', onContainer: '#03331f' },
      dark:  { main: '#5dd1a3', container: '#0f4a32', onContainer: '#cdf0df' },
    },
  },
  {
    calendarId: 'cybersecurity',
    label: 'Cybersécurité',
    categories: ['cybersécurité & prévention'],
    colors: {
      light: { main: '#c2410c', container: '#fcd9c2', onContainer: '#4a1500' },
      dark:  { main: '#fb9b6e', container: '#5c1f08', onContainer: '#fcd9c2' },
    },
  },
  {
    calendarId: 'social',
    label: 'Vie sociale',
    categories: ['action & aide sociale', 'lieux d\'accueil'],
    colors: {
      light: { main: '#b45309', container: '#fde6c0', onContainer: '#3f1d00' },
      dark:  { main: '#fbbf65', container: '#5a2f06', onContainer: '#fde6c0' },
    },
  },
  {
    calendarId: 'formation',
    label: 'Formation générale',
    categories: ['formation générale'],
    colors: {
      light: { main: '#7c3aed', container: '#e4d4fb', onContainer: '#2a0c5a' },
      dark:  { main: '#b48cf5', container: '#3b1a73', onContainer: '#e4d4fb' },
    },
  },
  {
    calendarId: 'institutional',
    label: 'Institutionnel',
    categories: ['associations & réseaux', 'institutions publiques', 'plateformes d\'information'],
    colors: {
      light: { main: '#475569', container: '#dde2ea', onContainer: '#1a2230' },
      dark:  { main: '#a3b0c2', container: '#2e3a4d', onContainer: '#dde2ea' },
    },
  },
  {
    calendarId: 'other',
    label: 'Autre',
    categories: [],
    colors: {
      light: { main: '#6b7280', container: '#e3e5e9', onContainer: '#1f2329' },
      dark:  { main: '#a1a8b3', container: '#3a3f47', onContainer: '#e3e5e9' },
    },
  },
];

/**
 * Maps an event's categories array to its Schedule-X calendarId.
 * Priority is the order of DISPLAY_BUCKETS — first matching bucket wins.
 */
export function getCalendarId(eventCategories: string[] | null | undefined): string {
  if (!eventCategories || eventCategories.length === 0) return 'other';
  for (const bucket of DISPLAY_BUCKETS) {
    if (eventCategories.some(c => bucket.categories.includes(c))) {
      return bucket.calendarId;
    }
  }
  return 'other';
}

/**
 * Builds the `calendars` object Schedule-X expects, keyed by calendarId.
 */
export function buildScheduleXCalendars() {
  return Object.fromEntries(
    DISPLAY_BUCKETS.map(b => [
      b.calendarId,
      { colorName: b.calendarId, lightColors: b.colors.light, darkColors: b.colors.dark },
    ])
  );
}