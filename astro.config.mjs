// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import alpinejs from "@astrojs/alpinejs";
import solid from "@astrojs/solid-js";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  site: "https://eclaire.protect.ngo",
  output: "server",
  // Alpine et Solid coexistent le temps de la migration : Alpine scanne le DOM
  // qu'il trouve, Solid possede ses sous-arbres d'ile. Alpine part au dernier commit.
  integrations: [
    alpinejs({
      entrypoint: "/alpine-config",
    }),
    solid(),
  ],
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
    {
      provider: fontProviders.local(),
      name: "Founders Grotesk X-Condensed Bold",
      cssVariable: "--font-founders-grotesk",
      weights: ["100 900"],
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/founders-grotesk-x-condensed-bold.woff2"],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "Founders Grotesk X-Condensed Medium",
      cssVariable: "--font-founders-grotesk-medium",
      weights: ["700"],
      options: {
        variants: [
          {
            src: [
              "./src/assets/fonts/founders-grotesk-x-condensed-semibold.woff2",
            ],
          },
        ],
      },
    },
  ],
});
