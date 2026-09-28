import type { PageAnalysis, ClassificationResult, Category } from "@/lib/types";

/**
 * Keyword families used only as *signals* on publicly visible content
 * (title, meta description, H1, visible text, nav, URL structure) — never
 * on the domain name alone, per PRD §8.
 */
const SIGNAL_GROUPS: { category: Exclude<Category, "Unknown" | "Irrelevant">; keywords: string[] }[] = [
  {
    category: "Casino",
    keywords: ["casino", "roulette", "blackjack", "baccarat", "live dealer", "jackpot"],
  },
  {
    category: "Betting",
    keywords: ["betting", "sportsbook", "odds", "bet now", "wager", "parlay", "exchange betting"],
  },
  {
    category: "Gambling",
    keywords: ["gambling", "real money", "deposit bonus", "withdraw winnings", "rummy", "teen patti"],
  },
  {
    category: "Game APK",
    keywords: ["apk download", ".apk", "download app", "install apk", "app-ver"],
  },
  {
    category: "Game Platform",
    keywords: ["crash game", "slot game", "card game", "play now", "gaming platform", "arcade"],
  },
  {
    category: "Gaming",
    keywords: ["online game", "multiplayer", "leaderboard", "game lobby"],
  },
];

function extractVisibleSignalText(page: PageAnalysis): string {
  const parts = [page.title, page.h1, page.metaDescription].filter(Boolean).join(" ");
  return `${parts} ${page.url}`.toLowerCase();
}

/**
 * Best-effort, transparent keyword-signal classifier. It is intentionally
 * simple and auditable: every match is recorded in matchedSignals so the
 * dashboard can show *why* a domain was classified a certain way, rather
 * than presenting a black-box verdict as fact.
 */
export function classifySite(pages: PageAnalysis[]): ClassificationResult {
  const haystacks = pages.map(extractVisibleSignalText);
  const combined = haystacks.join(" ");

  const scored = SIGNAL_GROUPS.map((group) => {
    const matched = group.keywords.filter((kw) => combined.includes(kw));
    return { category: group.category, matched };
  }).filter((s) => s.matched.length > 0);

  if (scored.length === 0) {
    return { category: "Unknown", confidence: 0, matchedSignals: [] };
  }

  scored.sort((a, b) => b.matched.length - a.matched.length);
  const top = scored[0];

  // Confidence scales with number of distinct signals matched, capped at 0.95
  // (never claim certainty — best-effort classification only).
  const confidence = Math.min(0.95, 0.35 + top.matched.length * 0.15);

  return {
    category: top.category,
    confidence: Number(confidence.toFixed(2)),
    matchedSignals: top.matched,
  };
}

export function relevanceLabel(confidence: number): "HIGH" | "MEDIUM" | "LOW" {
  if (confidence >= 0.7) return "HIGH";
  if (confidence >= 0.4) return "MEDIUM";
  return "LOW";
}
