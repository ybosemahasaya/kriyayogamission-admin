import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
// The cloudflare() plugin reads wrangler.jsonc, runs the Worker (worker/index.ts)
// inside the same Vite dev server as the React app, and wires up the ASSETS
// binding so `vite build` produces both the static SPA (dist/client) and the
// Worker bundle `wrangler deploy` expects -- one project, one dev server,
// no separate backend process to juggle.
export default defineConfig({
  plugins: [react(), cloudflare()],
});
