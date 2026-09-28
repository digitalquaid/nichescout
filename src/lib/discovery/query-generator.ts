import type { Category } from "@/lib/types";

/**
 * Internal query families per niche (PRD §5). The user only ticks categories
 * in Settings → Niche; this module expands that into actual search queries
 * so nobody has to hand-write hundreds of keywords.
 */
const QUERY_FAMILIES: Record<Exclude<Category, "Unknown" | "Irrelevant">, string[]> = {
  Gambling: ["online gambling site", "real money gambling app", "gambling website new"],
  Casino: ["online casino", "casino game site", "new online casino 2026", "live casino website"],
  "Game Platform": ["gaming platform", "crash game website", "slot game site", "card game platform"],
  "Game APK": ["game apk download site", "new apk gaming app", "download game apk website"],
  Betting: ["betting game website", "sports betting site new", "online betting platform"],
  Gaming: ["online game website", "new online game 2026", "gaming website launch"],
};

const MODIFIERS = ["new", "latest", "2026", "register", "sign up", "play now"];

export function generateQueries(activeCategories: Category[]): { query: string; category: Category }[] {
  const queries: { query: string; category: Category }[] = [];

  for (const category of activeCategories) {
    const base = QUERY_FAMILIES[category as keyof typeof QUERY_FAMILIES];
    if (!base) continue; // skip Unknown / Irrelevant, they're not seed categories

    for (const q of base) {
      queries.push({ query: q, category });
    }

    // Light expansion: pair the first base query with a couple of modifiers,
    // rather than a full cartesian product (keeps free-tier API quota sane).
    for (const modifier of MODIFIERS.slice(0, 2)) {
      queries.push({ query: `${base[0]} ${modifier}`, category });
    }
  }

  // De-duplicate.
  const seen = new Set<string>();
  return queries.filter((q) => {
    const key = q.query.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
