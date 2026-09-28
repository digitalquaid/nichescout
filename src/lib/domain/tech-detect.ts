import * as cheerio from "cheerio";
import type { TechResult } from "@/lib/types";

interface Signature {
  technology: string;
  category: TechResult["category"];
  test: (html: string, headers: Headers) => boolean;
}

const SIGNATURES: Signature[] = [
  { technology: "WordPress", category: "cms", test: (h) => /wp-content|wp-includes/i.test(h) },
  { technology: "Shopify", category: "cms", test: (h) => /cdn\.shopify\.com/i.test(h) },
  { technology: "Wix", category: "cms", test: (h) => /static\.wixstatic\.com/i.test(h) },
  { technology: "React", category: "frontend", test: (h) => /data-reactroot|__NEXT_DATA__|react-dom/i.test(h) },
  { technology: "Next.js", category: "frontend", test: (h) => /__NEXT_DATA__/i.test(h) },
  { technology: "Vue.js", category: "frontend", test: (h) => /data-v-app|__VUE__/i.test(h) },
  { technology: "Google Analytics", category: "analytics", test: (h) => /gtag\(|google-analytics\.com|googletagmanager\.com\/gtag/i.test(h) },
  { technology: "Google Tag Manager", category: "tag_manager", test: (h) => /googletagmanager\.com\/gtm\.js/i.test(h) },
  { technology: "Facebook Pixel", category: "analytics", test: (h) => /connect\.facebook\.net.*fbevents/i.test(h) },
  { technology: "Cloudflare", category: "cdn", test: (_h, headers) => (headers.get("server") ?? "").toLowerCase().includes("cloudflare") },
  { technology: "jQuery", category: "js_library", test: (h) => /jquery(\.min)?\.js/i.test(h) },
  { technology: "Bootstrap", category: "js_library", test: (h) => /bootstrap(\.min)?\.css|bootstrap(\.min)?\.js/i.test(h) },
];

export function detectTechnologies(html: string, headers: Headers): TechResult[] {
  const results: TechResult[] = [];

  for (const sig of SIGNATURES) {
    try {
      if (sig.test(html, headers)) {
        results.push({ technology: sig.technology, category: sig.category, confidence: "best_effort" });
      }
    } catch {
      // A single bad signature shouldn't break detection for the rest.
    }
  }

  const server = headers.get("server");
  if (server) {
    results.push({ technology: server, category: "server", confidence: "best_effort" });
  }

  return results;
}
