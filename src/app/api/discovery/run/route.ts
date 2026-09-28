import { NextRequest, NextResponse } from "next/server";
import { runDiscovery } from "@/lib/discovery/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Category } from "@/lib/types";

export const maxDuration = 60; // seconds; Vercel Hobby plan cap — see README for GitHub Actions alternative

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.DISCOVERY_CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data: settingsRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "target_categories")
      .single();

    const activeCategories = (settingsRow?.value as Category[] | undefined) ?? [
      "Gambling",
      "Casino",
      "Game Platform",
      "Game APK",
      "Betting",
      "Gaming",
    ];

    const summary = await runDiscovery(activeCategories);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("Discovery run failed:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
