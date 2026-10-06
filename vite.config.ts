import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Same-origin RPC proxy. vercel.json declares the same path for production.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/genlayer-rpc": {
        target: "https://studio.genlayer.com",
        changeOrigin: true,
        secure: true,
        rewrite: () => "/api",
      },
    },
  },
});
