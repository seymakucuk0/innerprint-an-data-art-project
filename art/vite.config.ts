import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// On GitHub Pages the site is served from
//   https://<user>.github.io/innerprint-an-data-art-project/
// so production assets need the repo path as their base. Dev server
// stays at the root so the registered Spotify redirect URI
// (http://127.0.0.1:5173/) keeps working.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/innerprint-an-data-art-project/" : "/",
  server: { host: true },
}));
