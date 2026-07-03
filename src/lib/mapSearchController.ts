import { $mapData } from "./mapStore";
import type { Data } from "../interfaces/dbData";
import type {
  ChatMsg,
  ChatApiResponse,
} from "../interfaces/mapSearchUtils";

export function initMapSearchController() {
  const aiForm = document.getElementById("aiForm") as HTMLFormElement;
  const aiFormSubmit = document.getElementById("aiFormSubmit");
  const aiReset = document.getElementById("aiReset");
  const filterForm = document.getElementById("filters-form") as HTMLFormElement;
  const searchBar = document.getElementById("search-bar") as HTMLInputElement;
  const clearSearch = document.getElementById("clear-search");
  const aiInfo = document.getElementById("aiInfo");
  const filtersReset = document.getElementById("filtersReset");

  let history: ChatMsg[] = [];
  const orgIdsOnMap = new Set<string>();
  let initialOrgs: Data[] = [];

  function dispatchChatMessage(msg: ChatMsg) {
    window.dispatchEvent(new CustomEvent("chat-message", { detail: msg }));
  }

  function setThinking(value: boolean) {
    window.dispatchEvent(new CustomEvent("chat-thinking", { detail: value }));
    if (aiFormSubmit) (aiFormSubmit as HTMLButtonElement).disabled = value;
    document.body.classList.toggle("chat-thinking", value);
  }

  function waitForOrgsDone(): Promise<void> {
    return new Promise((resolve) => {
      const handler = () => {
        window.removeEventListener("orgs-done", handler);
        resolve();
      };
      window.addEventListener("orgs-done", handler);
    });
  }

  function waitForEventsDone(): Promise<void> {
    return new Promise((resolve) => {
      const handler = () => {
        window.removeEventListener("events-done", handler);
        resolve();
      };
      window.addEventListener("events-done", handler);
    });
  }

  function waitForMessageDone(): Promise<void> {
    return new Promise((resolve) => {
      const handler = () => {
        window.removeEventListener("message-done", handler);
        resolve();
      };
      window.addEventListener("message-done", handler);
    });
  }

  function resetConversation() {
    history = [];
    orgIdsOnMap.clear();
    $mapData.set(initialOrgs);
    window.dispatchEvent(new CustomEvent("chat-reset"));
    aiReset?.classList.add("none");
    aiInfo?.classList.remove("none");
  }

  async function populateFilters() {
    try {
      const res = await fetch("/api/dataInit", {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const baseData = await res.json();
      const data: Data[] = baseData.data;
      initialOrgs = data;
      $mapData.set(data);

      const allCat: string[] = [
        ...new Set(
          data.flatMap((item) =>
            item.categories.map((cat) => cat.toLowerCase()),
          ),
        ),
      ].filter((el) => el != "");
      window.dispatchEvent(
        new CustomEvent("populate-categories", { detail: allCat.sort() }),
      );

      const allLoc = [...new Set(data.map((item) => item.city))].filter(
        (el) => el != "",
      );
      window.dispatchEvent(
        new CustomEvent("populate-locations", { detail: allLoc.sort() }),
      );
    } catch (err) {
      console.error("Failed to load orgs:", err);
    }
  }

  async function sendChatMessage(userText: string) {
    history.push({ role: "user", content: userText });
    dispatchChatMessage({ role: "user", content: userText });
    aiInfo?.classList.add("none");
    setThinking(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: AbortSignal.timeout(120000),
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const result: ChatApiResponse = await res.json();

      setThinking(false);

      let eventsFound = false;
      let skipNextText = false;

      const blocks = result.blocks;
      const eventSearchIdx = blocks.findIndex((b) => b.type === "event_search");
      const hasFallbackOrgs =
        eventSearchIdx !== -1 &&
        blocks.slice(eventSearchIdx + 1).some((b) => b.type === "orgs");

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        if (block.type === "text" && block.content) {
          if (skipNextText) {
            skipNextText = false;
            continue;
          }
          const donePromise = waitForMessageDone();
          dispatchChatMessage({ role: "assistant", content: block.content });
          await donePromise;
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
            const donePromise = waitForOrgsDone();
            window.dispatchEvent(
              new CustomEvent("orgs-result", { detail: orgsForBlock }),
            );

            const newOrgs = orgsForBlock.filter((o) => !orgIdsOnMap.has(o.id));
            newOrgs.forEach((o) => orgIdsOnMap.add(o.id));
            const current = $mapData.get() ?? [];
            const merged =
              orgIdsOnMap.size === newOrgs.length
                ? [...newOrgs]
                : [...current, ...newOrgs];
            $mapData.set(merged);

            aiReset?.classList.remove("none");
            await donePromise;
          }
        } else if (
          block.type === "event_search" &&
          result.events &&
          result.events.length > 0
        ) {
          eventsFound = true;
          const donePromise = waitForEventsDone();
          window.dispatchEvent(
            new CustomEvent("events-result", { detail: result.events }),
          );
          aiReset?.classList.remove("none");
          await donePromise;
        } else if (
          block.type === "event_search" &&
          (!result.events || result.events.length === 0)
        ) {
          eventsFound = false;

          if (hasFallbackOrgs) {
            skipNextText = true;
            const donePromise = waitForMessageDone();
            dispatchChatMessage({
              role: "assistant",
              content:
                "Je n'ai pas trouvé d'événements correspondants. Voici plutôt des organisations qui pourraient t'aider :",
            });
            await donePromise;
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
            const donePromise = waitForMessageDone();
            dispatchChatMessage({
              role: "assistant",
              content: filtersDescription
                ? `Je n'ai trouvé aucun événement${filtersDescription} sur cette période. Tu veux que j'élargisse les critères ?`
                : "Je n'ai trouvé aucun événement sur cette période. Tu veux que j'élargisse la recherche ?",
            });
            await donePromise;
            aiReset?.classList.remove("none");
          }
        }
      }

      history.push({
        role: "assistant",
        content: JSON.stringify({ blocks: result.blocks }),
      });
    } catch (err) {
      console.error("Chat call failed:", err);
      setThinking(false);
      const donePromise = waitForMessageDone();
      dispatchChatMessage({
        role: "assistant",
        content:
          "Désolé, je n'ai pas pu obtenir de réponse. Tu peux réessayer ?",
      });
      await donePromise;
    }
  }

  populateFilters();

  aiFormSubmit?.addEventListener("click", async (e) => {
    e.preventDefault();
    const text = searchBar.value.trim();
    if (!text) return;
    searchBar.value = "";
    clearSearch?.classList.add("none");
    await sendChatMessage(text);
  });

  aiReset?.addEventListener("click", () => {
    resetConversation();
  });

  aiForm?.addEventListener("input", () => {
    if (searchBar.value !== "") {
      clearSearch?.classList.remove("none");
    } else {
      clearSearch?.classList.add("none");
    }
  });

  clearSearch?.addEventListener("click", () => {
    searchBar.value = "";
    clearSearch.classList.add("none");
  });

  document.querySelectorAll(".quick-question-chip").forEach((chip) => {
    chip.addEventListener("click", async () => {
      if ((aiFormSubmit as HTMLButtonElement)?.disabled) return;
      const question = (chip as HTMLElement).dataset.question;
      if (!question) return;
      await sendChatMessage(question);
    });
  });

  filterForm?.addEventListener("change", async (e) => {
    e.preventDefault();
    const formData = new FormData(filterForm);
    const hasFilters = [...formData.values()].some((v) => v !== "");
    if (hasFilters) {
      filtersReset?.classList.remove("none");
    } else {
      filtersReset?.classList.add("none");
    }
    try {
      const res = await fetch("/api/dataFilter", {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(5000),
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const result = await res.json();
      const data: Data[] = result.data;
      $mapData.set(data);
    } catch (err) {
      console.error("Failed to load filtered orgs:", err);
    }
  });

  filtersReset?.addEventListener("click", () => {
    filterForm?.reset();
    $mapData.set(initialOrgs);
    filtersReset?.classList.add("none");
  });

  document.querySelectorAll(".swap").forEach((item) => {
    item.addEventListener("click", () => {
      const filter = document.getElementById("filters");
      const ai = document.getElementById("ai");
      const search = document.getElementById("search");
      const questions = document.getElementById("quickQuestions");
      filter?.classList.toggle("none");
      ai?.classList.toggle("none");
      search?.classList.toggle("none");
      questions?.classList.toggle("none");
    });
  });
}
