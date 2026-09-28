/**
 * Discovery MUST go through a provider-compliant search API (PRD §5) —
 * never a scraper that fights Google's bot protection. This file defines a
 * small provider interface plus one free-tier-friendly adapter so the
 * engine doesn't care which provider is behind it.
 *
 * Provider notes (verify current terms yourself before relying on them —
 * free-tier offers change):
 *  - Tavily: ~1,000 free search credits/month, no credit card required.
 *    https://tavily.com
 *  - Google Programmable Search Engine (CSE): 100 free queries/day.
 *    Google has slated the legacy Custom Search JSON API for shutdown on
 *    Jan 1, 2027, so treat this as a short/medium-term option only.
 *  - Bing Web Search API: being wound down by Microsoft; avoid building
 *    new dependencies on it.
 * Set SEARCH_PROVIDER in .env to choose one, and add its adapter below if
 * you pick something not yet implemented — the interface is intentionally small.
 */

export interface SearchResultItem {
  url: string;
  title: string;
}

export interface SearchProvider {
  name: string;
  search(query: string, maxResults: number): Promise<SearchResultItem[]>;
}

class TavilyProvider implements SearchProvider {
  name = "tavily";
  constructor(private apiKey: string) {}

  async search(query: string, maxResults: number): Promise<SearchResultItem[]> {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        max_results: maxResults,
        search_depth: "basic",
      }),
    });

    if (!res.ok) {
      throw new Error(`Tavily search failed (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as { results?: { url: string; title: string }[] };
    return (data.results ?? []).map((r) => ({ url: r.url, title: r.title }));
  }
}

class GoogleCseProvider implements SearchProvider {
  name = "google_cse";
  constructor(private apiKey: string, private searchEngineId: string) {}

  async search(query: string, maxResults: number): Promise<SearchResultItem[]> {
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("cx", this.searchEngineId);
    url.searchParams.set("q", query);
    url.searchParams.set("num", String(Math.min(maxResults, 10)));

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Google CSE search failed (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as { items?: { link: string; title: string }[] };
    return (data.items ?? []).map((i) => ({ url: i.link, title: i.title }));
  }
}

export function getSearchProvider(): SearchProvider {
  const provider = process.env.SEARCH_PROVIDER ?? "tavily";
  const apiKey = process.env.SEARCH_PROVIDER_API_KEY;

  if (!apiKey) {
    throw new Error("SEARCH_PROVIDER_API_KEY is not set. Add it to your environment before running discovery.");
  }

  switch (provider) {
    case "tavily":
      return new TavilyProvider(apiKey);
    case "google_cse": {
      const cx = process.env.GOOGLE_CSE_ID;
      if (!cx) throw new Error("GOOGLE_CSE_ID is required when SEARCH_PROVIDER=google_cse");
      return new GoogleCseProvider(apiKey, cx);
    }
    default:
      throw new Error(`Unknown SEARCH_PROVIDER "${provider}". Supported: tavily, google_cse.`);
  }
}
