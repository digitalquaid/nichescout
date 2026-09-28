import * as cheerio from "cheerio";
import type { PageAnalysis, CrawlResult } from "@/lib/types";
import { normalizeDomain, homepageUrlFor } from "@/lib/domain/normalize";

const USER_AGENT = "NicheScoutBot/1.0 (+public-page-analysis; respects robots.txt)";

export interface CrawlOptions {
  maxPages: number;
  maxDepth: number;
  timeoutMs: number;
}

const DEFAULT_OPTIONS: CrawlOptions = {
  maxPages: Number(process.env.DISCOVERY_MAX_PAGES_PER_DOMAIN ?? 30),
  maxDepth: Number(process.env.DISCOVERY_MAX_CRAWL_DEPTH ?? 2),
  timeoutMs: Number(process.env.DISCOVERY_PAGE_TIMEOUT_MS ?? 10000),
};

const PAGE_TYPE_HINTS: Array<{ type: PageAnalysis["pageType"]; patterns: RegExp[] }> = [
  { type: "login", patterns: [/login/i, /signin/i, /sign-in/i] },
  { type: "register", patterns: [/regist/i, /signup/i, /sign-up/i, /create-account/i, /join/i] },
  { type: "games", patterns: [/game/i, /slot/i, /casino/i, /bet/i] },
  { type: "download", patterns: [/download/i, /apk/i] },
  { type: "about", patterns: [/about/i] },
  { type: "contact", patterns: [/contact/i] },
  { type: "faq", patterns: [/faq/i, /help/i] },
  { type: "privacy", patterns: [/privacy/i] },
  { type: "terms", patterns: [/terms/i] },
  { type: "blog", patterns: [/blog/i, /news/i] },
];

function classifyPageType(url: string): PageAnalysis["pageType"] {
  for (const { type, patterns } of PAGE_TYPE_HINTS) {
    if (patterns.some((p) => p.test(url))) return type;
  }
  return "other";
}

interface RobotsRules {
  disallowed: string[];
  crawlDelayMs: number;
}

async function fetchRobotsRules(origin: string, timeoutMs: number): Promise<RobotsRules> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${origin}/robots.txt`, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    clearTimeout(t);
    if (!res.ok) return { disallowed: [], crawlDelayMs: 0 };

    const text = await res.text();
    const disallowed: string[] = [];
    let crawlDelayMs = 0;
    let inRelevantGroup = false;

    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (/^user-agent:\s*\*/i.test(line)) {
        inRelevantGroup = true;
        continue;
      }
      if (/^user-agent:/i.test(line)) {
        inRelevantGroup = false;
        continue;
      }
      if (!inRelevantGroup) continue;

      const disallowMatch = line.match(/^disallow:\s*(.+)$/i);
      if (disallowMatch && disallowMatch[1]) disallowed.push(disallowMatch[1].trim());

      const delayMatch = line.match(/^crawl-delay:\s*(\d+(\.\d+)?)/i);
      if (delayMatch && delayMatch[1]) crawlDelayMs = Math.max(crawlDelayMs, parseFloat(delayMatch[1]) * 1000);
    }

    return { disallowed, crawlDelayMs };
  } catch {
    // If robots.txt is unreachable, proceed conservatively with no extra disallow rules.
    return { disallowed: [], crawlDelayMs: 0 };
  }
}

function isDisallowed(pathname: string, rules: RobotsRules): boolean {
  return rules.disallowed.some((rule) => rule && pathname.startsWith(rule));
}

async function fetchPage(url: string, timeoutMs: number): Promise<{ html: string; status: number; headers: Headers } | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
    });
    clearTimeout(t);
    const html = await res.text();
    return { html, status: res.status, headers: res.headers };
  } catch {
    return null;
  }
}

function analyzePage(url: string, html: string, status: number): PageAnalysis {
  const $ = cheerio.load(html);
  return {
    url,
    pageType: classifyPageType(url),
    title: $("title").first().text().trim() || null,
    h1: $("h1").first().text().trim() || null,
    metaDescription: $('meta[name="description"]').attr("content") ?? null,
    statusCode: status,
    html,
  };
}

function extractInternalLinks(html: string, baseUrl: string, normalizedDomain: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const resolved = new URL(href, baseUrl).toString();
      if (normalizeDomain(resolved) === normalizedDomain) {
        links.add(resolved);
      }
    } catch {
      // ignore malformed hrefs
    }
  });

  return Array.from(links);
}

/**
 * Crawls a single domain within strict, configurable safety limits (PRD §15, §37):
 * respects robots.txt Disallow rules and Crawl-delay, caps pages/depth, times out
 * per page, never authenticates, never submits forms, and only reads what a normal
 * anonymous browser would see.
 */
export async function crawlDomain(
  normalizedDomain: string,
  options: Partial<CrawlOptions> = {}
): Promise<CrawlResult | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const origin = `https://${normalizedDomain}`;
  const homepageUrl = homepageUrlFor(normalizedDomain);

  const robotsRules = await fetchRobotsRules(origin, opts.timeoutMs);

  const homepageFetch = await fetchPage(homepageUrl, opts.timeoutMs);
  if (!homepageFetch) return null; // domain unreachable — nothing to record

  const homepage = analyzePage(homepageUrl, homepageFetch.html, homepageFetch.status);
  const httpsEnabled = homepageFetch.status > 0; // fetch already forced https:// above

  const visited = new Set<string>([homepageUrl]);
  const queue: Array<{ url: string; depth: number }> = extractInternalLinks(
    homepageFetch.html,
    homepageUrl,
    normalizedDomain
  ).map((url) => ({ url, depth: 1 }));

  const internalPages: PageAnalysis[] = [];

  while (queue.length > 0 && internalPages.length < opts.maxPages) {
    const next = queue.shift();
    if (!next) break;
    const { url, depth } = next;
    if (visited.has(url) || depth > opts.maxDepth) continue;

    const pathname = (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return "/";
      }
    })();
    if (isDisallowed(pathname, robotsRules)) continue;

    visited.add(url);

    if (robotsRules.crawlDelayMs > 0) {
      await new Promise((r) => setTimeout(r, robotsRules.crawlDelayMs));
    }

    const fetched = await fetchPage(url, opts.timeoutMs);
    if (!fetched) continue;

    internalPages.push(analyzePage(url, fetched.html, fetched.status));

    if (depth < opts.maxDepth) {
      for (const link of extractInternalLinks(fetched.html, url, normalizedDomain)) {
        if (!visited.has(link)) queue.push({ url: link, depth: depth + 1 });
      }
    }
  }

  return {
    homepage,
    internalPages,
    httpsEnabled,
    httpStatus: homepageFetch.status,
  };
}
