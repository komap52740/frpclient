import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_SITE_URL = "https://client.androidmultitool.ru";
const rawSiteUrl = (process.env.VITE_SITE_URL || DEFAULT_SITE_URL).trim();
const normalizedBase = rawSiteUrl.replace(/\/+$/, "");
const siteUrl = /^https?:\/\//i.test(normalizedBase) ? normalizedBase : `https://${normalizedBase}`;

const publicDir = resolve(__dirname, "../public");
const now = new Date().toISOString().slice(0, 10);

const robots = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /client/
Disallow: /master/
Disallow: /admin/
Disallow: /appointments/
Disallow: /clients/
Disallow: /django-admin/

Sitemap: ${siteUrl}/sitemap.xml
`;

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/login</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
`;

await mkdir(publicDir, { recursive: true });
await writeFile(resolve(publicDir, "robots.txt"), robots, "utf8");
await writeFile(resolve(publicDir, "sitemap.xml"), sitemap, "utf8");

console.log(`[seo] generated robots.txt and sitemap.xml for ${siteUrl}`);
