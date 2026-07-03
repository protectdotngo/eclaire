import { defineCollection, reference } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const partners = defineCollection({
  loader: glob({ pattern: "*.md", base: "src/data/eclaire-v1/partners" }),
  schema: z.object({
    name: z.string(),
    logo: z.string(),
    url: z.string(),
    address: z.string().optional(),
    hidden: z.boolean().optional(),
  }),
});

const resources = defineCollection({
  loader: glob({
    pattern: "**/[^_]*.md",
    base: "src/data/eclaire-v1/resources",
  }),
  schema: z.object({
    name: z.string(),
    url: z.string(),
    partner: reference("partners"),
  }),
});

export const collections = { partners, resources };
