// @ts-check
import { defineConfig } from "astro/config";
import alpinejs from "@astrojs/alpinejs";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  site: "https://eclaire.protect.ngo",
  output: "server",
  integrations: [
    alpinejs({
      entrypoint: "/alpine-config",
    }),
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
});
