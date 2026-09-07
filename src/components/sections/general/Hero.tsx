import { Show } from "solid-js";
import type { JSX } from "solid-js";
import styles from "./Hero.module.css";

interface HeroProps {
  title: string;
  lead?: string;
  lead2?: string;
  body?: string;
  image: string;
  comp?: boolean;
  /** Ancien <slot /> : rendu seulement si `comp`. */
  children?: JSX.Element;
  /** Ancien <slot name="intro" />. */
  intro?: JSX.Element;
}

export default function Hero(props: HeroProps) {
  return (
    // `hero-root` est une classe marqueur volontairement NON hachee : son seul
    // consommateur est le `:not(.hero-root)` de Technical.astro, qui doit exclure
    // le hero de la contrainte max-width appliquee aux autres sections.
    <section class={`hero-root ${styles.image}`}>
      <div class={styles["image-cont"]}>
        <div class={styles["image-bg"]}>
          <img src={props.image} alt="" />
        </div>
        <Show when={props.comp}>
          <div class={styles["image-box"]}>{props.children}</div>
        </Show>
      </div>

      <div class={styles["hero-intro"]}>
        <h1 class={styles["hero-intro-title"]} innerHTML={props.title} />
        <p class={styles["hero-intro-lead"]} innerHTML={props.lead ?? ""} />
        <p class={styles["hero-intro-lead-2"]} innerHTML={props.lead2 ?? ""} />
        <p class={styles["hero-intro-body"]} innerHTML={props.body ?? ""} />
        {props.intro}
      </div>
    </section>
  );
}
