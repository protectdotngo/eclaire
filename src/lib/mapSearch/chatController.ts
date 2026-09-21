import { $mapData } from "../mapStore";
import type { ChatApiResponse, ChatMsg } from "../../interfaces/chat";
import type { OrgWithChatContext } from "../../interfaces/org";
import type { TimelineStore } from "./timelineStore";
import type { FiltersStore } from "./filtersStore";

/** The parts of the shell state the controller drives. */
export interface ChatShell {
  setShowInfo(v: boolean): void;
  setShowReset(v: boolean): void;
}

export interface ChatController {
  /** Was sendChatMessage. */
  send(text: string): Promise<void>;
  /** Was resetConversation. */
  reset(): void;
  /** Was populateFilters + the three `populate-*` / `orgs-init` events. */
  loadInitialData(): Promise<void>;
}

function chatErrorMessage(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status === 429) {
    return "Tu as envoyé beaucoup de messages en peu de temps. Attends une minute, puis réessaie.";
  }
  if (status === 503) {
    return "Le service est très sollicité en ce moment. Réessaie dans un instant.";
  }
  if (
    status === 504 ||
    (err instanceof DOMException && err.name === "TimeoutError")
  ) {
    return "La réponse a mis trop de temps à arriver. Tu peux réessayer ?";
  }
  return "Désolé, je n'ai pas pu obtenir de réponse. Tu peux réessayer ?";
}

export function createChatController(deps: {
  timeline: TimelineStore;
  filters: FiltersStore;
  shell: ChatShell;
}): ChatController {
  const { timeline, filters, shell } = deps;

  let history: ChatMsg[] = [];
  const orgIdsOnMap = new Set<string>();
  let initialOrgs: OrgWithChatContext[] = [];
  // EC-41: the Builders card is shown at most once per conversation, so a user
  // who keeps talking about their association is not nagged on every turn.
  let buildersShown = false;

  return {
    async loadInitialData() {
      try {
        const res = await fetch("/api/dataInit", {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        const baseData = await res.json();
        const data: OrgWithChatContext[] = baseData.data;
        initialOrgs = data;
        $mapData.set(data);

        // Hand the full dataset to the filter store for local filtering. This
        // used to be the `orgs-init` window event, and the fallback at
        // FiltersPanel.astro:229 only existed because initMapSearchController()
        // ran before alpine:init — inside one island the order is
        // deterministic, so that fallback is gone.
        //
        // NOTE: setAllOrgs() calls apply(), which writes $mapData a second
        // time (sorted). Leaflet's fillMap therefore runs twice with two
        // fitBounds, which is observable as markers re-clustering on boot.
        // That is pre-existing behaviour, preserved deliberately.
        filters.setAllOrgs(data);

        const allLoc = [...new Set(data.map((item) => item.city))].filter(
          (el) => el != "",
        );
        filters.setAllLocations(allLoc.sort());
      } catch (err) {
        console.error("Failed to load orgs:", err);
      }
    },

    reset() {
      history = [];
      orgIdsOnMap.clear();
      buildersShown = false;
      $mapData.set(initialOrgs);
      timeline.reset();
      shell.setShowReset(false);
      shell.setShowInfo(true);
    },

    async send(userText: string) {
      history.push({ role: "user", content: userText });
      await timeline.addMessage({ role: "user", content: userText });
      shell.setShowInfo(false);
      timeline.setThinking(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: AbortSignal.timeout(120000),
        });
        if (res.status !== 200) {
          const httpError = new Error(`Status ${res.status}`) as Error & {
            status?: number;
          };
          httpError.status = res.status;
          throw httpError;
        }
        const result: ChatApiResponse = await res.json();

        timeline.setThinking(false);

        let eventsFound = false;
        let skipNextText = false;
        let skipAfterOrgsText = false;

        const blocks = result.blocks;
        const eventSearchIdx = blocks.findIndex(
          (b) => b.type === "event_search",
        );
        const hasFallbackOrgs =
          eventSearchIdx !== -1 &&
          blocks.slice(eventSearchIdx + 1).some((b) => b.type === "orgs");
        const orgsBlockIdx = blocks.findIndex(
          (b, i) =>
            b.type === "orgs" && eventSearchIdx !== -1 && i > eventSearchIdx,
        );

        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];

          if (block.type === "text" && block.content) {
            if (skipNextText) {
              skipNextText = false;
              continue;
            }
            if (skipAfterOrgsText && orgsBlockIdx !== -1 && i > orgsBlockIdx) {
              continue;
            }
            await timeline.addMessage({
              role: "assistant",
              content: block.content,
            });
          } else if (
            block.type === "orgs" &&
            result.orgs &&
            result.orgs.length > 0
          ) {
            const isAfterEventSearch =
              eventSearchIdx !== -1 && i > eventSearchIdx;
            if (isAfterEventSearch && eventsFound) {
              continue;
            }

            const blockIds = new Set((block.items ?? []).map((i) => i.id));
            const orgsForBlock = result.orgs.filter((o) => blockIds.has(o.id));

            if (orgsForBlock.length > 0) {
              const done = timeline.addOrgs(orgsForBlock);

              const newOrgs = orgsForBlock.filter(
                (o) => !orgIdsOnMap.has(o.id),
              );
              newOrgs.forEach((o) => orgIdsOnMap.add(o.id));
              const current = $mapData.get() ?? [];
              const merged =
                orgIdsOnMap.size === newOrgs.length
                  ? [...newOrgs]
                  : [...current, ...newOrgs];
              $mapData.set(merged);

              shell.setShowReset(true);
              await done;
            }
          } else if (block.type === "builders") {
            if (buildersShown) continue;
            buildersShown = true;
            timeline.addBuilders(block.lang);
            shell.setShowReset(true);
          } else if (
            block.type === "event_search" &&
            result.events &&
            result.events.length > 0
          ) {
            eventsFound = true;
            if (hasFallbackOrgs) skipAfterOrgsText = true;
            const done = timeline.addEvents(result.events);
            shell.setShowReset(true);
            await done;
          } else if (
            block.type === "event_search" &&
            (!result.events || result.events.length === 0)
          ) {
            eventsFound = false;

            if (hasFallbackOrgs) {
              skipNextText = true;
              skipAfterOrgsText = true;
              await timeline.addMessage({
                role: "assistant",
                content:
                  "Je n'ai pas trouvé d'événements correspondants. Voici plutôt des organisations qui pourraient t'aider :",
              });
            } else {
              const filters = block.filters;
              let filtersDescription = "";
              if (filters?.city) filtersDescription += ` à ${filters.city}`;
              if (filters?.categories?.length) {
                filtersDescription += ` dans le domaine "${filters.categories[0]}"`;
              }
              if (filters?.keywords?.length) {
                filtersDescription += ` sur "${filters.keywords.join(", ")}"`;
              }
              await timeline.addMessage({
                role: "assistant",
                content: filtersDescription
                  ? `Je n'ai trouvé aucun événement${filtersDescription} sur cette période. Tu veux que j'élargisse les critères ?`
                  : "Je n'ai trouvé aucun événement sur cette période. Tu veux que j'élargisse la recherche ?",
              });
              shell.setShowReset(true);
            }
          }
        }

        const paginationMeta =
          result.events && result.events.length > 0
            ? result.hasMoreEvents
              ? ` [Plus d'événements disponibles. Prochain offset: ${
                  (result.eventOffset ?? 0) + 10
                }.]`
              : ` [Aucun autre événement disponible pour ces filtres.]`
            : "";

        // The builders block is appended by the server, not authored by the
        // model. Keeping it out of the history means the model never sees a
        // block type it did not write and cannot start emitting its own.
        const modelBlocks = result.blocks.filter((b) => b.type !== "builders");

        history.push({
          role: "assistant",
          content: JSON.stringify({ blocks: modelBlocks }) + paginationMeta,
        });
      } catch (err) {
        console.error("Chat call failed:", err);
        timeline.setThinking(false);
        await timeline.addMessage({
          role: "assistant",
          content: chatErrorMessage(err),
        });
      }
    },
  };
}
