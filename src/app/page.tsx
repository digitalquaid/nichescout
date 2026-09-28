import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/StatCard";
import { SitesTable, type SiteRow } from "@/components/SitesTable";

export const revalidate = 0; // always fetch fresh — this is a monitoring dashboard

async function getDashboardData() {
  const supabase = createServerSupabaseClient();

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [{ count: newToday }, { count: newThisWeek }, { count: totalSites }, { data: recentSites }] =
    await Promise.all([
      supabase.from("sites").select("id", { count: "exact", head: true }).gte("first_seen_at", startOfToday.toISOString()),
      supabase.from("sites").select("id", { count: "exact", head: true }).gte("first_seen_at", startOfWeek.toISOString()),
      supabase.from("sites").select("id", { count: "exact", head: true }),
      supabase
        .from("sites")
        .select(
          "domain, category, first_seen_at, https_enabled, status, auth_detection(login_detected, register_detected, registration_form_detected), pages(count)"
        )
        .order("first_seen_at", { ascending: false })
        .limit(25),
    ]);

  return {
    newToday: newToday ?? 0,
    newThisWeek: newThisWeek ?? 0,
    totalSites: totalSites ?? 0,
    recentSites: (recentSites ?? []) as unknown as SiteRow[],
  };
}

export default async function DashboardPage() {
  const { newToday, newThisWeek, totalSites, recentSites } = await getDashboardData();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Dashboard</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="New Today" value={newToday} />
        <StatCard label="This Week" value={newThisWeek} />
        <StatCard label="Total Sites" value={totalSites} />
        <StatCard label="Monitoring" value="ACTIVE" />
      </div>

      <h2 className="mb-3 text-sm font-medium text-muted">Recently Discovered</h2>
      <SitesTable rows={recentSites} />
    </div>
  );
}
