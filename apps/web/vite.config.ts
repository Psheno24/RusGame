import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: null,
      includeAssets: ["icon.svg"],
      devOptions: {
        enabled: true,
        type: "module",
      },
      manifest: {
        name: "Россия — жизнь",
        short_name: "Россия",
        description: "Экономическая игра по городам России",
        theme_color: "#0f141b",
        background_color: "#0f141b",
        display: "standalone",
        lang: "ru",
        start_url: "/",
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
