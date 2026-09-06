import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Keeps the demo subdomain out of search indexes and points its
// canonical/OG URLs at demo.eclipsemuhendislik.com instead of the main site.
const demoSeo = (): Plugin => ({
  name: "demo-seo",
  apply: "build",
  transformIndexHtml(html) {
    return html
      .replaceAll('https://eclipsemuhendislik.com', 'https://demo.eclipsemuhendislik.com')
      .replace(
        "<head>",
        '<head>\n    <meta name="robots" content="noindex, nofollow" />',
      );
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), mode === "demo" && demoSeo()].filter(Boolean),
  build: {
    outDir: mode === "demo" ? "dist/demo" : "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
