"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const ALL_CATEGORIES = ["Gambling", "Casino", "Game Platform", "Game APK", "Betting", "Gaming"];

const FILTER_LABELS: Record<string, string> = {
  new_domain: "New domain discovered",
  registration_detected: "Registration detected",
  login_detected: "Login detected",
  both_login_and_registration: "Both Login + Registration detected",
  high_relevance: "High niche relevance",
  sitemap_detected: "Sitemap detected",
  apk_download_section: "New site with APK/download section",
};

export default function SettingsPage() {
  const supabase = createBrowserSupabaseClient();
  const [categories, setCategories] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    async function load() {
      const [{ data: cat }, { data: filt }] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", "target_categories").single(),
        supabase.from("app_settings").select("value").eq("key", "notification_filters").single(),
      ]);
      setCategories((cat?.value as string[]) ?? []);
      setFilters((filt?.value as Record<string, boolean>) ?? {});
      setLoading(false);
    }
    load();
  }, [supabase]);

  function toggleCategory(c: string) {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function toggleFilter(key: string) {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function save() {
    setSaving(true);
    await Promise.all([
      supabase.from("app_settings").update({ value: categories, updated_at: new Date().toISOString() }).eq("key", "target_categories"),
      supabase.from("app_settings").update({ value: filters, updated_at: new Date().toISOString() }).eq("key", "notification_filters"),
    ]);
    setSaving(false);
    setSavedAt(new Date());
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-40 w-full max-w-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="card">
        <h2 className="mb-3 text-sm font-medium text-muted">Target Niche</h2>
        <div className="space-y-2">
          {ALL_CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={categories.includes(c)} onChange={() => toggleCategory(c)} className="accent-primary" />
              {c}
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-medium text-muted">Notify me when</h2>
        <div className="space-y-2">
          {Object.entries(FILTER_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!filters[key]} onChange={() => toggleFilter(key)} className="accent-primary" />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-bg disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {savedAt && <span className="text-xs text-muted">Saved {savedAt.toLocaleTimeString()}</span>}
      </div>

      <p className="text-xs text-muted">
        Discovery interval, page/depth limits, and Telegram credentials are set via environment variables (see
        README) rather than here, since they're secrets or deploy-time config.
      </p>
    </div>
  );
}
