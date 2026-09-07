import { createMemo, createSignal, For, Show } from "solid-js";
import Hero from "../sections/general/Hero";
import Background from "../sections/general/Background";
import Icon from "../icons/Icon";
import Resource from "./sections/Resource";
import {
  ResourcesContext,
  type PartnerOption,
  type ResourceDTO,
  type ResourcesStore,
} from "./sections/resourcesContext";
import chevronDownRaw from "../../assets/images/chevron-down.svg?raw";
import styles from "./ResourcesIsland.module.css";

interface ResourcesIslandProps {
  resources: ResourceDTO[];
  partners: PartnerOption[];
}

export default function ResourcesIsland(props: ResourcesIslandProps) {
  const [selectedPartner, setSelectedPartner] = createSignal("");

  // Replaces Alpine's `filteredCount` getter, which derived its state from the
  // DOM via document.querySelectorAll(".v1-resource-card[data-partner]").
  const visibleResources = createMemo(() => {
    const id = selectedPartner();
    return id === ""
      ? props.resources
      : props.resources.filter((r) => r.partnerId === id);
  });

  const store: ResourcesStore = {
    get resources() {
      return props.resources;
    },
    get partners() {
      return props.partners;
    },
    selectedPartner,
    setSelectedPartner,
    visibleResources,
  };

  return (
    <ResourcesContext.Provider value={store}>
      <section class={styles["v1-resources"]}>
        <Hero
          title="Besoin d'aide ?"
          lead="Laissez-vous éclairer par nos ressources utiles"
          image="/images/library.jpg"
          intro={
            <div class={styles["v1-resources-filter"]}>
              <label
                for="partner-filter"
                class={styles["v1-resources-filter-label"]}
              >
                Filtrer par partenaire
              </label>
              <div class={styles["v1-resources-filter-wrap"]}>
                <select
                  id="partner-filter"
                  class={styles["v1-resources-filter-select"]}
                  value={selectedPartner()}
                  onChange={(e) => setSelectedPartner(e.currentTarget.value)}
                >
                  <option value="">Toutes les ressources</option>
                  <For each={props.partners}>
                    {(partner) => (
                      <option value={partner.id} innerHTML={partner.name} />
                    )}
                  </For>
                </select>
                <span class={styles["v1-resources-filter-chevron"]}>
                  <Icon raw={chevronDownRaw} />
                </span>
              </div>
            </div>
          }
        />

        <div class={styles["v1-resources-grid"]}>
          <Background />
          <For each={visibleResources()}>
            {(resource) => <Resource resource={resource} />}
          </For>
        </div>

        <Show when={visibleResources().length === 0}>
          <div class={styles["v1-resources-empty"]}>
            Aucune ressource ne correspond à ce filtre.
          </div>
        </Show>
      </section>
    </ResourcesContext.Provider>
  );
}
