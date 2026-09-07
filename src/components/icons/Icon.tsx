import styles from "./Icon.module.css";

interface IconProps {
  /** SVG content imported via `?raw` (the idiom already used in Map.astro). */
  raw: string;
  class?: string;
}

/**
 * Renders an inline SVG inside a Solid island.
 *
 * Astro's default `.svg` import returns an *Astro* component and cannot be
 * rendered from Solid JSX; `?raw` gives the string instead. We keep the SVG
 * inline (rather than an <img>) because `stroke="currentColor"` is load-bearing:
 * the project's CSS colours the icons by inheritance.
 */
export default function Icon(props: IconProps) {
  return (
    <span
      class={props.class ? `${styles.slot} ${props.class}` : styles.slot}
      aria-hidden="true"
      innerHTML={props.raw}
    />
  );
}
