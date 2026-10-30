import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://supercopanr.solofutbolamateur.com',
  trailingSlash: 'ignore',
  integrations: [sitemap({ filter: (url) => !url.includes('/offline/') })],
  vite: { plugins: [tailwindcss()] },
});
