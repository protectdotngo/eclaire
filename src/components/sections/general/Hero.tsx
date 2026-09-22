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
  /** The former <slot />: rendered only when `comp` is set. */
  children?: JSX.Element;
  /** The former <slot name="intro" />. */
  intro?: JSX.Element;
}

export default function Hero(props: HeroProps) {
  return (
    // `hero-root` is a deliberately UNHASHED marker class: its only consumer is
    // Technical.astro's `:not(.hero-root)`, which has to exclude the hero from
    // the max-width constraint applied to every other section.
    <section class={`hero-root ${styles.image}`}>
      <div class={styles["image-cont"]}>
        <div class={styles["image-bg"]}>
          <svg width="0" height="0" style={{ position: "absolute" }}>
            <clipPath id="hero-clip" clipPathUnits="objectBoundingBox">
              <path
                transform={`scale(${1 / 876}, ${1 / 600})`}
                d="M0 571.523V0H876V332.294C876 349.485 864.635 364.585 848.114 369.36L36.7141 598.76C18.4312 604.292 0 590.625 0 571.523Z"
              />
            </clipPath>
          </svg>

          <img
            src={props.image}
            style={{ "clip-path": "url(#hero-clip)" }}
            alt=""
          />
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
