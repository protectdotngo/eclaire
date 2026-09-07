import styles from "./Icon.module.css";

interface IconProps {
  /** Contenu SVG importe via `?raw` (l'idiome deja utilise dans Map.astro). */
  raw: string;
  class?: string;
}

/**
 * Rend un SVG inline dans une ile Solid.
 *
 * L'import `.svg` par defaut d'Astro renvoie un composant *Astro* et ne peut pas
 * etre rendu depuis du JSX Solid ; `?raw` donne la chaine. On garde le SVG inline
 * (et non un <img>) parce que `stroke="currentColor"` est porteur : le CSS du
 * projet colore les icones par heritage.
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
