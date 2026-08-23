import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // forwards to a locally running `npm run dev -w server` (server/.env's
    // PORT, default 8787 — server/src/index.js) so /api/* is same-origin from
    // the browser's perspective even in dev, matching production exactly
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
