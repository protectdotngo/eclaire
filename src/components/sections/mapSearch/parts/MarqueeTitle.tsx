import { onCleanup, onMount } from "solid-js";

interface MarqueeTitleProps {
  title: string;
  wrapClass: string;
  titleClass: string;
  overflowingClass: string;
}

/**
 * Scrolls an event title that is too wide for its container.
 *
 * This was a whole ResizeObserver written inline as an `x-init` attribute
 * string. Moved into onMount, and it now actually disconnects the observer —
 * the Alpine version never did.
 */
export default function MarqueeTitle(props: MarqueeTitleProps) {
  let wrap!: HTMLDivElement;

  onMount(() => {
    const update = () => {
      const title = wrap.querySelector<HTMLElement>(`.${props.titleClass}`);
      if (!title) return;
      if (title.scrollWidth > wrap.clientWidth) {
        wrap.classList.add(props.overflowingClass);
        wrap.style.setProperty("--wrap-width", wrap.clientWidth + "px");
        const overflow = title.scrollWidth - wrap.clientWidth;
        const duration = Math.max(8, overflow / 50 + 4);
        wrap.style.setProperty("--marquee-duration", duration + "s");
      } else {
        wrap.classList.remove(props.overflowingClass);
        wrap.style.removeProperty("--wrap-width");
      }
    };

    void document.fonts.ready.then(() => setTimeout(update, 50));
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    onCleanup(() => ro.disconnect());
  });

  return (
    <div class={props.wrapClass} ref={wrap}>
      <span class={props.titleClass}>{props.title}</span>
    </div>
  );
}
