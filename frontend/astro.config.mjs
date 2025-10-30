// frontend/astro.config.mjs

import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://space-proxy-tau.vercel.app",
  base: "/",
  integrations: [
    tailwind()
  ],
  output: "server",
  adapter: vercel({
    // optional adapter settings
    // webAnalytics: { enabled: true },
    // imageService: true,
    // isr: { expiration: 60 }
  }),
  vite: {
    resolve: {
      alias: {
        "@components": "./src/components",
        "@pages": "./src/pages",
        "@styles": "./src/styles"
      }
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV)
    }
  },
  devOptions: {
    // etc. if needed
  },
  build: {
    // other build options if you use them
  }
});
