import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";

export const revalidate = 0;

async function getSite(domain: string) {
  const supabase = createServerSupabaseClient();

  const { data: site } = await supabase.from("sites").select("*").eq("domain", domain).maybeSingle();
  if (!site) return null;

  const [{ data: auth }, { data: seo }, { data: technologies }, { data: pages }, { data: discoveries }] =
    await Promise.all([
      supabase.from("auth_detection").select("*").eq("site_id", site.id).maybeSingle(),
      supabase.from("seo_data").select("*").eq("site_id", site.id).maybeSingle(),
      supabase.from("technologies").select("*").eq("site_id", site.id),
      supabase.from("pages").select("*").eq("site_id", site.id).order("discovered_at", { ascending: true }),
      supabase.from("discoveries").select("*").eq("site_id", site.id).order("discovered_at", { ascending: false }).limit(20),
    ]);

  return { site, auth, seo, technologies: technologies ?? [], pages: pages ?? [], discoveries: discoveries ?? [] };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-medium text-muted">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right">{value ?? <span className="text-muted">—</span>}</span>
    </div>
  );
}

export default async function SiteDetailPage({ params }: { params: { domain: string } }) {
  const data = await getSite(decodeURIComponent(params.domain));
  if (!data) notFound();
  const { site, auth, seo, technologies, pages, discoveries } = data;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{site.domain}</h1>
          <span className="badge badge-yes">{site.category}</span>
        </div>
        <p className="text-sm text-muted">
          First seen {new Date(site.first_seen_at).toLocaleString()} · Last seen{" "}
          {new Date(site.last_seen_at).toLocaleString()} · Status:{" "}
          <span className="capitalize">{site.status}</span>
        </p>
        <p className="mt-2 text-xs text-muted">
          Classification confidence: {(site.classification_confidence * 100).toFixed(0)}% (best-effort — not a
          verified claim of ownership or an "official site" designation)
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Login / Register">
          <p className="mb-1 text-xs font-medium text-primary">LOGIN</p>
          <Field label="URL" value={auth?.login_url} />
          <Field label="Detected" value={<StatusBadge ok={!!auth?.login_detected} />} />
          <Field label="Fields" value={auth?.login_fields?.join(", ")} />

          <p className="mb-1 mt-4 text-xs font-medium text-primary">REGISTER</p>
          <Field label="URL" value={auth?.register_url} />
          <Field label="Detected" value={<StatusBadge ok={!!auth?.register_detected} />} />
          <Field label="Form Detected" value={<StatusBadge ok={!!auth?.registration_form_detected} />} />
          <Field label="Fields" value={auth?.registration_fields?.join(", ")} />
          <Field label="OTP" value={<StatusBadge ok={!!auth?.otp_detected} />} />
          <Field label="Captcha" value={<StatusBadge ok={!!auth?.captcha_detected} />} />
          <Field label="Registration Level" value={`Level ${auth?.registration_level ?? 0} / 4`} />
        </Section>

        <Section title="SEO">
          <Field label="Title" value={seo?.title} />
          <Field label="Meta Description" value={seo?.meta_description} />
          <Field label="H1" value={pages.find((p) => p.page_type === "home")?.h1} />
          <Field label="Canonical" value={seo?.canonical} />
          <Field label="Robots Meta" value={seo?.robots_meta} />
          <Field label="Sitemap" value={<StatusBadge ok={!!seo?.sitemap_detected} />} />
          <Field label="Robots.txt" value={<StatusBadge ok={!!seo?.robots_detected} />} />
          <Field label="Language" value={seo?.language} />
          <Field label="OG Title" value={seo?.og_title} />
        </Section>

        <Section title="Technology (best-effort)">
          {technologies.length === 0 ? (
            <p className="text-sm text-muted">No technologies confidently detected.</p>
          ) : (
            technologies.map((t) => (
              <Field key={t.id} label={t.category.replace("_", " ")} value={t.technology} />
            ))
          )}
        </Section>

        <Section title="Pages Crawled">
          <Field label="Public Pages" value={pages.length} />
          <Field label="HTTPS" value={<StatusBadge ok={site.https_enabled} />} />
          <Field label="HTTP Status" value={site.http_status} />
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-muted">
            {pages.map((p) => (
              <li key={p.id} className="truncate">
                <span className="capitalize text-text">{p.page_type}</span> — {p.url}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Discovery History">
        <ul className="space-y-2 text-sm">
          {discoveries.map((d) => (
            <li key={d.id} className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
              <span className="text-muted">{new Date(d.discovered_at).toLocaleString()}</span>
              <span className="capitalize">{d.event.replace(/_/g, " ")}</span>
              <span className="text-xs text-muted">{d.source}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
