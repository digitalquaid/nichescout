import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeDomain, homepageUrlFor } from "@/lib/domain/normalize";
import { classifySite, relevanceLabel } from "@/lib/domain/classify";
import { detectAuth } from "@/lib/domain/detect-auth";
import { extractSeo, checkWellKnownFiles } from "@/lib/domain/seo";
import { detectTechnologies } from "@/lib/domain/tech-detect";
import { crawlDomain } from "@/lib/discovery/crawler";
import { generateQueries } from "@/lib/discovery/query-generator";
import { getSearchProvider } from "@/lib/discovery/search-providers";
import { sendTelegramAlert } from "@/lib/notify/telegram";
import type { Category, NotificationFilters } from "@/lib/types";

export interface DiscoveryRunSummary {
  queriesRun: number;
  candidatesSeen: number;
  newDomains: number;
  updatedDomains: number;
  notificationsSent: number;
  errors: string[];
}

function shouldNotify(
  filters: NotificationFilters,
  input: {
    isNew: boolean;
    loginDetected: boolean;
    registerDetected: boolean;
    relevance: "HIGH" | "MEDIUM" | "LOW";
    sitemapDetected: boolean;
    apkSection: boolean;
  }
): boolean {
  if (input.isNew && filters.new_domain) return true;
  if (input.registerDetected && filters.registration_detected) return true;
  if (input.loginDetected && filters.login_detected) return true;
  if (input.loginDetected && input.registerDetected && filters.both_login_and_registration) return true;
  if (input.relevance === "HIGH" && filters.high_relevance) return true;
  if (input.sitemapDetected && filters.sitemap_detected) return true;
  if (input.apkSection && filters.apk_download_section) return true;
  return false;
}

/**
 * Runs one full discovery pass: generate queries → query the search provider →
 * normalize + dedupe domains → crawl within safety limits → classify, detect
 * auth/SEO/tech → persist → notify. Mirrors PRD §34 exactly.
 */
export async function runDiscovery(activeCategories: Category[]): Promise<DiscoveryRunSummary> {
  const supabase = createAdminClient();
  const summary: DiscoveryRunSummary = {
    queriesRun: 0,
    candidatesSeen: 0,
    newDomains: 0,
    updatedDomains: 0,
    notificationsSent: 0,
    errors: [],
  };

  const maxDomainsPerRun = Number(process.env.DISCOVERY_MAX_DOMAINS_PER_RUN ?? 25);

  const { data: settingsRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "notification_filters")
    .single();
  const filters = (settingsRow?.value as NotificationFilters) ?? {
    new_domain: true,
    registration_detected: true,
    login_detected: true,
    both_login_and_registration: true,
    high_relevance: true,
    sitemap_detected: false,
    apk_download_section: true,
  };

  const provider = getSearchProvider();
  const queries = generateQueries(activeCategories);

  const seenDomainsThisRun = new Set<string>();

  for (const { query, category: seedCategory } of queries) {
    if (seenDomainsThisRun.size >= maxDomainsPerRun) break;
    summary.queriesRun += 1;

    let results;
    try {
      results = await provider.search(query, 10);
    } catch (err) {
      summary.errors.push(`search("${query}") failed: ${(err as Error).message}`);
      continue;
    }

    for (const result of results) {
      if (seenDomainsThisRun.size >= maxDomainsPerRun) break;

      const normalized = normalizeDomain(result.url);
      if (!normalized) continue;
      summary.candidatesSeen += 1;

      if (seenDomainsThisRun.has(normalized)) continue;
      seenDomainsThisRun.add(normalized);

      try {
        const { data: existing } = await supabase
          .from("sites")
          .select("id, first_seen_at")
          .eq("normalized_domain", normalized)
          .maybeSingle();

        const isNew = !existing;

        if (existing) {
          // Duplicate — just bump last_seen / discovery_count (PRD §7).
          await supabase
            .from("sites")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", existing.id);
          await supabase.rpc("increment_discovery_count", { site_id: existing.id }).select();
          await supabase.from("discoveries").insert({
            site_id: existing.id,
            event: "seen_again",
            source: provider.name,
            source_query: query,
            source_url: result.url,
          });
          summary.updatedDomains += 1;
          continue;
        }

        // New domain: crawl within safety limits (PRD §15, §37).
        const crawl = await crawlDomain(normalized);
        if (!crawl) {
          summary.errors.push(`crawl failed / unreachable: ${normalized}`);
          continue;
        }

        const allPages = [crawl.homepage, ...crawl.internalPages];
        const classification = classifySite(allPages);
        const auth = detectAuth(crawl.homepage, crawl.internalPages);
        const wellKnown = await checkWellKnownFiles(homepageUrlFor(normalized), 8000);
        const seo = extractSeo(crawl.homepage.html, wellKnown.sitemapDetected, wellKnown.robotsDetected);
        const tech = detectTechnologies(crawl.homepage.html, new Headers());

        const { data: inserted, error: insertError } = await supabase
          .from("sites")
          .insert({
            domain: normalized,
            normalized_domain: normalized,
            category: classification.category === "Unknown" ? seedCategory : classification.category,
            classification_confidence: classification.confidence,
            homepage_url: homepageUrlFor(normalized),
            https_enabled: crawl.httpsEnabled,
            http_status: crawl.httpStatus,
          })
          .select("id")
          .single();

        if (insertError || !inserted) {
          summary.errors.push(`insert failed for ${normalized}: ${insertError?.message}`);
          continue;
        }

        const siteId = inserted.id as string;

        await supabase.from("pages").insert(
          allPages.map((p) => ({
            site_id: siteId,
            url: p.url,
            page_type: p.pageType,
            title: p.title,
            h1: p.h1,
            meta_description: p.metaDescription,
            status_code: p.statusCode,
          }))
        );

        await supabase.from("auth_detection").insert({
          site_id: siteId,
          login_detected: auth.loginDetected,
          login_url: auth.loginUrl,
          register_detected: auth.registerDetected,
          register_url: auth.registerUrl,
          registration_form_detected: auth.registrationFormDetected,
          login_fields: auth.loginFields,
          registration_fields: auth.registrationFields,
          otp_detected: auth.otpDetected,
          captcha_detected: auth.captchaDetected,
          registration_level: auth.registrationLevel,
        });

        await supabase.from("seo_data").insert({
          site_id: siteId,
          title: seo.title,
          meta_description: seo.metaDescription,
          canonical: seo.canonical,
          robots_meta: seo.robotsMeta,
          language: seo.language,
          og_title: seo.ogTitle,
          og_description: seo.ogDescription,
          sitemap_detected: seo.sitemapDetected,
          robots_detected: seo.robotsDetected,
        });

        if (tech.length > 0) {
          await supabase.from("technologies").insert(
            tech.map((t) => ({ site_id: siteId, technology: t.technology, category: t.category, confidence: t.confidence }))
          );
        }

        await supabase.from("discoveries").insert({
          site_id: siteId,
          event: "first_discovered",
          source: provider.name,
          source_query: query,
          source_url: result.url,
        });

        summary.newDomains += 1;

        const relevance = relevanceLabel(classification.confidence);
        const apkSection = allPages.some((p) => p.pageType === "download");

        if (
          shouldNotify(filters, {
            isNew,
            loginDetected: auth.loginDetected,
            registerDetected: auth.registerDetected,
            relevance,
            sitemapDetected: seo.sitemapDetected,
            apkSection,
          })
        ) {
          await sendTelegramAlert({
            domain: normalized,
            category: classification.category === "Unknown" ? seedCategory : classification.category,
            firstSeenAt: new Date().toISOString(),
            loginDetected: auth.loginDetected,
            registerDetected: auth.registerDetected,
            registrationFormDetected: auth.registrationFormDetected,
            otpDetected: auth.otpDetected,
            captchaDetected: auth.captchaDetected,
            httpsEnabled: crawl.httpsEnabled,
            pageCount: allPages.length,
          });
          summary.notificationsSent += 1;
        }
      } catch (err) {
        summary.errors.push(`${normalized}: ${(err as Error).message}`);
      }
    }
  }

  return summary;
}
