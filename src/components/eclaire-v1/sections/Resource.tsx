import ResourcePartner from "./ResourcePartner";
import type { ResourceDTO } from "./resourcesContext";
import styles from "./Resource.module.css";

interface ResourceProps {
  resource: ResourceDTO;
}

export default function Resource(props: ResourceProps) {
  // Replaces Resource.astro's module <script>, which attached its handlers via
  // querySelectorAll(".v1-resource-card") once at page load and therefore never
  // saw re-rendered cards.
  const open = () => {
    window.open(props.resource.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      class={styles["v1-resource-card"]}
      role="link"
      tabindex="0"
      onClick={(e) => {
        if (e.target instanceof Element && e.target.closest("a")) return;
        open();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      <div class={styles["v1-resource-card-header"]}>
        <h3 class={styles["v1-resource-card-title"]}>{props.resource.name}</h3>
        <ResourcePartner
          name={props.resource.partnerName}
          url={props.resource.partnerUrl}
        />
      </div>
      <hr />
      <div
        class={styles["v1-resource-card-description"]}
        innerHTML={props.resource.bodyHtml}
      />
    </div>
  );
}
