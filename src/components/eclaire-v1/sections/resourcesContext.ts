import { createContext, useContext } from "solid-js";
import type { Accessor } from "solid-js";

/**
 * A resource, flattened to cross the island boundary.
 *
 * A `CollectionEntry` cannot be passed as-is: `render(entry)` returns an Astro
 * component (`<Content />`), neither serialisable nor renderable by Solid. The
 * Markdown is therefore turned into HTML in the `.astro` shell's frontmatter,
 * where the `reference("partners")` link is also resolved once — instead of one
 * `getEntry` per card.
 */
export interface ResourceDTO {
  id: string;
  name: string;
  url: string;
  partnerId: string;
  /** May contain markup (e.g. `Protect<sup>.ngo</sup>`). */
  partnerName: string;
  partnerUrl: string;
  bodyHtml: string;
}

export interface PartnerOption {
  id: string;
  /** May contain markup. */
  name: string;
}

export interface ResourcesStore {
  /** Static data from the server: no signal. */
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
