import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SitesTable, type SiteRow } from "@/components/SitesTable";

export const revalidate = 0;

const CATEGORIES = ["Gambling", "Casino", "Game Platform", "Game APK", "Betting", "Gaming", "Unknown", "Irrelevant"];

async function getSites(search: string, category: string) {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("sites")
    .select(
      "domain, category, first_seen_at, https_enabled, status, auth_detection(login_detected, register_detected, registration_form_detected), pages(count)"
    )
    .order("first_seen_at", { ascending: false })
    .limit(100);

  if (search) query = query.ilike("domain", `%${search}%`);
  if (category) query = query.eq("category", category);

  const { data } = await query;
  return (data ?? []) as unknown as SiteRow[];
}

export default async function AllSitesPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string };
}) {
  const search = searchParams.q ?? "";
  const category = searchParams.category ?? "";
  const rows = await getSites(search, category);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">All Sites</h1>

      <form className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={search}
          placeholder="Search domain..."
          className="w-64 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <select
          name="category"
          defaultValue={category}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-bg">
          Filter
        </button>
      </form>

      <div className="mb-4 flex gap-3 text-sm">
        <a href="/api/export?format=csv" className="text-primary hover:underline">
          Export CSV
        </a>
        <a href="/api/export?format=json" className="text-primary hover:underline">
          Export JSON
        </a>
      </div>

      <SitesTable rows={rows} />
    </div>
  );
}
