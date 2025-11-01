import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://space-proxy-tau.vercel.app",
  base: "/",
  integrations: [
    react()
  ],
  output: "server",
  adapter: vercel({
    // optional adapter settings
  }),
  vite: {
    plugins: [
      tailwindcss()
    ],
    resolve: {
      alias: {
        "@components": "./src/components",
        "@pages":      "./src/pages",
        "@styles":     "./src/styles"
      }
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV)
    }
  },
  devOptions: {
    // optional
  },
  build: {
    // optional
  }
});
