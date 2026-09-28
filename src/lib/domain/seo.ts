import * as cheerio from "cheerio";
import type { SeoResult } from "@/lib/types";

export function extractSeo(html: string, sitemapDetected: boolean, robotsDetected: boolean): SeoResult {
  const $ = cheerio.load(html);

  const getMeta = (name: string) =>
    $(`meta[name="${name}"]`).attr("content") ?? $(`meta[property="${name}"]`).attr("content") ?? null;

  return {
    title: $("title").first().text().trim() || null,
    metaDescription: getMeta("description"),
    canonical: $('link[rel="canonical"]').attr("href") ?? null,
    robotsMeta: getMeta("robots"),
    language: $("html").attr("lang") ?? null,
    ogTitle: getMeta("og:title"),
    ogDescription: getMeta("og:description"),
    sitemapDetected,
    robotsDetected,
  };
}

/** Checks /sitemap.xml and /robots.txt with lightweight HEAD-first requests. */
export async function checkWellKnownFiles(
  baseUrl: string,
  timeoutMs: number
): Promise<{ sitemapDetected: boolean; robotsDetected: boolean }> {
  const check = async (path: string) => {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(new URL(path, baseUrl).toString(), {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "NicheScoutBot/1.0 (+https://github.com/) public-page-analysis" },
      });
      clearTimeout(t);
      return res.ok;
    } catch {
      return false;
    }
  };

  const [sitemapDetected, robotsDetected] = await Promise.all([
    check("/sitemap.xml"),
    check("/robots.txt"),
  ]);

  return { sitemapDetected, robotsDetected };
}
