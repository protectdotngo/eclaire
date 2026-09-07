import type { JSX } from "solid-js";
import styles from "./Icon.module.css";

interface IconProps {
  /** SVG content imported via `?raw` (the idiom already used in Map.astro). */
  raw: string;
  class?: string;
  /** Kept for rules that target an id, e.g. the global `#clear-search`. */
  id?: string;
  /** Override the SVG's intrinsic 24x24, as `width`/`height` attributes did. */
  width?: string | number;
  height?: string | number;
  onClick?: JSX.EventHandlerUnion<HTMLSpanElement, MouseEvent>;
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
  const sized = () => props.width !== undefined || props.height !== undefined;
  const cls = () =>
    [styles.slot, sized() ? styles.sized : "", props.class ?? ""]
      .filter(Boolean)
      .join(" ");

  return (
    <span
      class={cls()}
      id={props.id}
      aria-hidden="true"
      onClick={props.onClick}
      style={
        sized()
          ? {
              width:
                typeof props.width === "number"
                  ? `${props.width}px`
                  : props.width,
              height:
                typeof props.height === "number"
                  ? `${props.height}px`
                  : props.height,
            }
          : undefined
      }
      innerHTML={props.raw}
    />
  );
}
