// Configuration Astro du portfolio.
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://elise-lhopitault-product-designer-p.vercel.app",
  // Génère about.html, gpc.html… (comme avant) : les URLs propres restent gérées par Vercel.
  build: { format: "file" },
  // Garde le HTML tel qu'écrit, sans le compresser, pour un rendu identique.
  compressHTML: false,
});
