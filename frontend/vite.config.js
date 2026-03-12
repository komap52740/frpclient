import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("axios")) {
            return "vendor-axios";
          }
          if (id.includes("dayjs")) {
            return "vendor-dayjs";
          }
          if (id.includes("zod")) {
            return "vendor-validation";
          }
          if (id.includes("@dnd-kit/")) {
            return "vendor-dnd";
          }
          if (id.includes("reactflow") || id.includes("@xyflow")) {
            return "vendor-flow";
          }
          if (id.includes("recharts") || id.includes("d3-")) {
            return "vendor-charts";
          }
          if (id.includes("@tanstack/react-query") || id.includes("@tanstack/query-core")) {
            return "vendor-query";
          }
          if (
            id.includes("react-router") ||
            id.includes("react-dom") ||
            /node_modules[\\/](react|scheduler|history)[\\/]/.test(id)
          ) {
            return "vendor-react";
          }
          if (id.includes("@mui/icons-material")) {
            return "vendor-icons";
          }
          if (id.includes("@mui/") || id.includes("@emotion/")) {
            return "vendor-ui";
          }
          return "vendor-core";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_PROXY || "http://localhost:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: process.env.VITE_DEV_WS_PROXY || "ws://localhost:8001",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
