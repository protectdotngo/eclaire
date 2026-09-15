// @ts-check
import { existsSync } from "node:fs";
import { defineConfig, fontProviders } from "astro/config";
import solid from "@astrojs/solid-js";
import node from "@astrojs/node";

// Founders Grotesk is commercially licensed (Klim Type Foundry) and cannot be
// redistributed, so it lives in a private submodule at src/assets/fonts/ rather
// than in this repository. Public clones cannot fetch it, so the family is
// registered only when the file is actually present — otherwise Astro's local
// font provider throws CannotDetermineWeightAndStyleFromFontFile and the build
// fails outright. See NOTICE.
const foundersGroteskSrc =
  "./src/assets/fonts/founders-grotesk-x-condensed-bold.woff2";
const hasFoundersGrotesk = existsSync(
  new URL(foundersGroteskSrc, import.meta.url),
);

if (!hasFoundersGrotesk) {
  console.warn(
    "[fonts] Founders Grotesk not found — run `git submodule update --init` if you have access. Falling back to Neue Haas Grotesk.",
  );
}

/**
 * Registered only when the font file is present. The `variants` cast is needed
 * because Astro types it as a non-empty tuple, which TypeScript will not infer
 * from an array literal outside a directly contextually-typed position.
 */
const foundersGrotesk = hasFoundersGrotesk
  ? [
      {
        provider: fontProviders.local(),
        name: "Founders Grotesk X-Condensed Bold",
        cssVariable: "--font-founders-grotesk",
        weights: /** @type {[string]} */ (["100 900"]),
        options: {
          variants: /** @type {[{ src: [string] }]} */ ([
            { src: [foundersGroteskSrc] },
          ]),
        },
      },
    ]
  : [];

// https://astro.build/config
export default defineConfig({
  site: "https://eclaire.protect.ngo",
  output: "server",
  integrations: [solid()],
  security: {
    allowedDomains: [
      {
        hostname: "eclaire.protect.ngo",
        protocol: "https",
      },
    ],
    checkOrigin: false,
  },
  adapter: node({
    mode: "standalone",
  }),
  vite: {
    define: {
      __HAS_FOUNDERS_GROTESK__: JSON.stringify(hasFoundersGrotesk),
    },
  },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Inter Tight",
      cssVariable: "--font-inter-tight",
      weights: ["100 900"],
    },
    {
      provider: fontProviders.adobe({ id: "qnf5dqp" }),
      name: "Neue Haas Grotesk Display",
      cssVariable: "--font-neue-haas-grotesk",
      weights: ["100 900"],
    },
    ...foundersGrotesk,
  ],
});
