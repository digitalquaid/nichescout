/**
 * Entry point for `npm run discover`, invoked by the GitHub Actions cron
 * workflow (.github/workflows/discovery.yml). Runs directly against Supabase
 * with the service-role key — no HTTP hop through Vercel, so it isn't bound
 * by serverless function time limits. This is the PRD §31 "Background jobs:
 * GitHub Actions" path.
 */
import { runDiscovery } from "@/lib/discovery/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Category } from "@/lib/types";

async function main() {
  const supabase = createAdminClient();

  const { data: settingsRow, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "target_categories")
    .single();

  if (error) {
    console.error("Could not load target_categories from app_settings:", error.message);
    process.exit(1);
  }

  const activeCategories = (settingsRow?.value as Category[] | undefined) ?? [];
  if (activeCategories.length === 0) {
    console.log("No active niche categories configured — nothing to discover. Set some in Settings → Niche.");
    return;
  }

  console.log(`Starting discovery run for: ${activeCategories.join(", ")}`);
  const summary = await runDiscovery(activeCategories);
  console.log(JSON.stringify(summary, null, 2));

  if (summary.errors.length > 0) {
    console.warn(`Completed with ${summary.errors.length} non-fatal error(s).`);
  }
}

main().catch((err) => {
  console.error("Discovery run crashed:", err);
  process.exit(1);
});
