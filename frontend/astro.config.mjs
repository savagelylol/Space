// frontend/astro.config.mjs

import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel";

// If you have environment variables / aliasing, you can import 'path' etc.
import path from "path";

export default defineConfig({
  // Site URL (used for sitemaps, RSS, canonical URLs)
  site: "https://your-domain.vercel.app",

  // Set base path if your site is deployed under a path prefix (optional)
  // Example: if deployed at https://domain.com/space/, set base: "/space/"
  base: "/",

  // Integrations for CSS / UI
  integrations: [
    tailwind({
      // Optional Tailwind config overrides
      config: {
        // You can extend theme etc here
      }
    })
  ],

  // Specify output mode:
  // 'static' means purely static build; 'server' means SSR output; can choose based on features you need.
  output: "server",

  // Adapter for Vercel deployment
  adapter: vercel({
    // Optional configuration for the adapter
    // For example:
    // webAnalytics: { enabled: true },
    // imagesConfig: { sizes: [320, 640, 1280], domains: ['your-domain.vercel.app'] },
    // isr: { expiration: 60, bypassToken: process.env.BYPASS_TOKEN },
    // edgeMiddleware: true
  }),

  // Vite configuration (for custom aliasing, environment variables, etc)
  vite: {
    resolve: {
      alias: {
        // Example aliases
        "@components": path.resolve("./src/components"),
        "@pages":      path.resolve("./src/pages"),
        "@styles":     path.resolve("./src/styles"),
      }
    },
    // Other Vite options e.g., define, optimizeDeps, server proxy etc.
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    }
  },

  // Markdown / MDSveX / other site-wide config could go here:
  markdown: {
    // Example: enable footnotes, GitHub-style headings etc
  },

  // Optional: preview / dev server configuration
  devOptions: {
    // port: 3000,
    // tailwind.configPath: "./tailwind.config.cjs"
  },

  // Optional: build options
  build: {
    // Example: specify cleanDist, sitemap, etc
    // siteDir: "dist",  // default is fine
    // pageUrlFormat: "directory", // how pages urls are formatted
  }
});
