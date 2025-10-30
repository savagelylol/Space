// frontend/astro.config.mjs

import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel";

export default defineConfig({
  // Use Tailwind CSS integration
  integrations: [
    tailwind()
  ],

  // Set the site URL (for canonical, sitemap, etc) — change to your production URL
  site: "https://space-proxy-tau.vercel.app",

  // Output mode: if you have dynamic API or server-side rendering, use 'server'; 
  // if purely static frontend, you may use 'static'
  output: "server",

  adapter: vercel({
    // Here you can pass adapter config (optional)
    // e.g., enable Vercel Web Analytics:
    // webAnalytics: { enabled: true },
    // If you need ISR (Incremental Static Regeneration): isr: true
  }),

  // Your other config options (e.g., dev server, build options, etc)
  // For example, you can define alias or Vite settings:
  vite: {
    // Example: resolve aliases
    resolve: {
      alias: {
        "@components": "./src/components",
        "@pages": "./src/pages"
      }
    }
  },

  // If you have client-side only code or islands you can configure those too
  // Other options like publicDir, srcDir etc default are okay unless you changed them
});
