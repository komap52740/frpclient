import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config.js";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: false,
      include: ["src/**/*.a11y.test.{js,jsx,ts,tsx}"],
      reporters: "default",
      css: false,
      setupFiles: ["./src/test/setupTests.js"],
    },
  })
);
