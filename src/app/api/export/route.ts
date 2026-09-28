import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const format = req.nextUrl.searchParams.get("format") === "json" ? "json" : "csv";

  const { data: sites } = await supabase
    .from("sites")
    .select(
      "domain, category, first_seen_at, https_enabled, auth_detection(login_detected, register_detected, registration_fields), seo_data(title, meta_description, sitemap_detected)"
    )
    .order("first_seen_at", { ascending: false });

  const rows = (sites ?? []).map((s: any) => ({
    domain: s.domain,
    category: s.category,
    first_seen: s.first_seen_at,
    login_detected: s.auth_detection?.login_detected ?? false,
    registration_detected: s.auth_detection?.register_detected ?? false,
    registration_fields: (s.auth_detection?.registration_fields ?? []).join("|"),
    title: s.seo_data?.title ?? "",
    meta_description: s.seo_data?.meta_description ?? "",
    https: s.https_enabled,
    sitemap: s.seo_data?.sitemap_detected ?? false,
  }));

  if (format === "json") {
    return NextResponse.json(rows, {
      headers: { "Content-Disposition": 'attachment; filename="nichescout-export.json"' },
    });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="nichescout-export.csv"',
    },
  });
}
