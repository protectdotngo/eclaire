// @ts-check
import { defineConfig } from "astro/config";
import alpinejs from "@astrojs/alpinejs";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [
    alpinejs({
      entrypoint: "/alpine-config",
    }),
  ],
  adapter: node({
    mode: "standalone",
  }),
});
