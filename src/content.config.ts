import { defineCollection, reference } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const partners = defineCollection({
  loader: glob({ pattern: "*.md", base: "src/data/partners" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      logo: image(),
      url: z.string(),
      address: z.string().optional(),
      hidden: z.boolean().optional(),
      categories: z.array(z.enum(["community", "sponsor"])),
    }),
});

const resources = defineCollection({
  loader: glob({
    pattern: "**/[^_]*.md",
    base: "src/data/resources",
  }),
  schema: z.object({
    name: z.string(),
    url: z.string(),
    partner: reference("partners"),
  }),
});

export const collections = { partners, resources };
