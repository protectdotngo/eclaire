// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node'

import vercel from '@astrojs/vercel';

import alpinejs from '@astrojs/alpinejs';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [alpinejs()]
});