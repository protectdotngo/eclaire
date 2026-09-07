import { DISPLAY_BUCKETS } from "../data/calendarConfig";
import { AUDIENCE_TAGS } from "../data/audienceTags";

/**
 * Taxonomie partagee : categories thematiques et publics vises.
 *
 * Ce calcul existait a l'identique dans `calendarState.ts` et dans
 * `propose/FieldCategories.astro`, et `mapSearch/FiltersPanel.astro` importait
 * la version du calendrier — un composant de la carte qui dependait donc de
 * l'etat du calendrier. Il vit desormais ici, sans dependance a flatpickr
 * (que `calendarState.ts` importe au niveau module, et qui se retrouvait de ce
 * fait dans le bundle de la page d'accueil).
 */
export const ALL_CATEGORIES = DISPLAY_BUCKETS.flatMap((bucket) =>
  bucket.categories.map((cat) => ({
    name: cat,
    label: cat.charAt(0).toUpperCase() + cat.slice(1),
    color: bucket.colors.light.main,
    bg: bucket.colors.light.container,
    text: bucket.colors.light.onContainer,
  })),
);

export const AUDIENCES = AUDIENCE_TAGS.map((tag) => ({
  name: tag,
  label: tag.charAt(0).toUpperCase() + tag.slice(1),
}));

export type CategoryTag = (typeof ALL_CATEGORIES)[number];
export type AudienceTag = (typeof AUDIENCES)[number];
