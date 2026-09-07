import { createContext, useContext } from "solid-js";
import type { Accessor } from "solid-js";

/**
 * Une ressource, aplatie pour traverser la frontiere d'ile.
 *
 * On ne peut pas passer une `CollectionEntry` telle quelle : `render(entry)`
 * renvoie un composant Astro (`<Content />`), ni serialisable ni rendable par
 * Solid. Le Markdown est donc converti en HTML dans le frontmatter de la
 * coquille `.astro`, et le lien `reference("partners")` y est resolu une seule
 * fois — au lieu d'un `getEntry` par carte.
 */
export interface ResourceDTO {
  id: string;
  name: string;
  url: string;
  partnerId: string;
  /** Peut contenir du markup (ex. `Protect<sup>.ngo</sup>`). */
  partnerName: string;
  partnerUrl: string;
  bodyHtml: string;
}

export interface PartnerOption {
  id: string;
  /** Peut contenir du markup. */
  name: string;
}

export interface ResourcesStore {
  /** Donnees statiques venues du serveur : pas de signal. */
  resources: readonly ResourceDTO[];
  partners: readonly PartnerOption[];
  selectedPartner: Accessor<string>;
  setSelectedPartner(v: string): void;
  visibleResources: Accessor<readonly ResourceDTO[]>;
}

export const ResourcesContext = createContext<ResourcesStore>();

export function useResources(): ResourcesStore {
  const ctx = useContext(ResourcesContext);
  if (!ctx) {
    throw new Error("useResources() doit etre appele dans <ResourcesIsland>");
  }
  return ctx;
}
