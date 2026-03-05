import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generateSeoFiles, resolveSiteUrl } from "./generate-seo-files.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const siteUrl = resolveSiteUrl(process.env.VITE_SITE_URL);
process.env.VITE_SITE_URL = siteUrl;

await generateSeoFiles(siteUrl);

const viteBin = resolve(__dirname, "../node_modules/vite/bin/vite.js");
const result = spawnSync(process.execPath, [viteBin, "build"], {
  stdio: "inherit",
  env: process.env,
});

if (typeof result.status === "number" && result.status !== 0) {
  process.exit(result.status);
}

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
