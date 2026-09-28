-- NicheScout database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- sites
-- ─────────────────────────────────────────────────────────────
create table if not exists sites (
  id uuid primary key default uuid_generate_v4(),
  domain text not null unique,
  normalized_domain text not null unique,
  category text not null default 'Unknown'
    check (category in ('Gambling','Casino','Game Platform','Game APK','Betting','Gaming','Unknown','Irrelevant')),
  classification_confidence numeric(3,2) not null default 0, -- 0.00–1.00
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','offline','irrelevant','archived')),
  homepage_url text not null,
  https_enabled boolean not null default false,
  http_status int,
  discovery_count int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sites_first_seen on sites (first_seen_at desc);
create index if not exists idx_sites_category on sites (category);
create index if not exists idx_sites_status on sites (status);

-- Atomically bumps discovery_count when a known domain is seen again (PRD §7).
create or replace function increment_discovery_count(site_id uuid)
returns void as $$
  update sites set discovery_count = discovery_count + 1, updated_at = now() where id = site_id;
$$ language sql;

-- ─────────────────────────────────────────────────────────────
-- pages
-- ─────────────────────────────────────────────────────────────
create table if not exists pages (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references sites(id) on delete cascade,
  url text not null,
  page_type text not null default 'other'
    check (page_type in ('home','login','register','games','download','about','contact','faq','privacy','terms','blog','other')),
  title text,
  h1 text,
  meta_description text,
  status_code int,
  discovered_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  unique (site_id, url)
);
create index if not exists idx_pages_site on pages (site_id);

-- ─────────────────────────────────────────────────────────────
-- auth_detection (one row per site, latest snapshot)
-- ─────────────────────────────────────────────────────────────
create table if not exists auth_detection (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references sites(id) on delete cascade unique,
  login_detected boolean not null default false,
  login_url text,
  register_detected boolean not null default false,
  register_url text,
  registration_form_detected boolean not null default false,
  login_fields text[] not null default '{}',
  registration_fields text[] not null default '{}',
  otp_detected boolean not null default false,
  captcha_detected boolean not null default false,
  registration_level int not null default 0, -- 0=none,1=page,2=form,3=interactive,4=verification-required
  last_checked_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- seo_data (one row per site, latest snapshot)
-- ─────────────────────────────────────────────────────────────
create table if not exists seo_data (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references sites(id) on delete cascade unique,
  title text,
  meta_description text,
  canonical text,
  robots_meta text,
  language text,
  og_title text,
  og_description text,
  sitemap_detected boolean not null default false,
  robots_detected boolean not null default false,
  last_checked_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- technologies (many rows per site)
-- ─────────────────────────────────────────────────────────────
create table if not exists technologies (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references sites(id) on delete cascade,
  technology text not null,
  category text not null check (category in ('cms','frontend','server','analytics','tag_manager','cdn','js_library','other')),
  confidence text not null default 'best_effort' check (confidence in ('best_effort','likely','unknown')),
  detected_at timestamptz not null default now(),
  unique (site_id, technology)
);

-- ─────────────────────────────────────────────────────────────
-- discoveries (append-only log; powers "Discovery History" tab)
-- ─────────────────────────────────────────────────────────────
create table if not exists discoveries (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references sites(id) on delete cascade,
  event text not null default 'seen_again'
    check (event in ('first_discovered','seen_again','new_page_detected','registration_detected','login_detected')),
  source text not null,        -- e.g. 'bing_search'
  source_query text,           -- the query that surfaced it
  source_url text,             -- the exact URL returned by the provider
  discovered_at timestamptz not null default now()
);
create index if not exists idx_discoveries_site on discoveries (site_id, discovered_at desc);

-- ─────────────────────────────────────────────────────────────
-- screenshots (V2 — table reserved so schema doesn't need to migrate later)
-- ─────────────────────────────────────────────────────────────
create table if not exists screenshots (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references sites(id) on delete cascade,
  page_id uuid references pages(id) on delete set null,
  image_url text not null,
  page_type text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- niche_config (single-row-ish settings table for section 29 admin settings)
-- ─────────────────────────────────────────────────────────────
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into app_settings (key, value) values
  ('target_categories', '["Gambling","Casino","Game Platform","Game APK","Betting","Gaming"]')
  on conflict (key) do nothing;
insert into app_settings (key, value) values
  ('notification_filters', '{"new_domain":true,"registration_detected":true,"login_detected":true,"both_login_and_registration":true,"high_relevance":true,"sitemap_detected":false,"apk_download_section":true}')
  on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- Dashboard reads happen with the anon key as an authenticated admin user;
-- all writes (discovery worker) happen with the service_role key, which
-- bypasses RLS by design. Never ship the service_role key to the browser.
-- ─────────────────────────────────────────────────────────────
alter table sites enable row level security;
alter table pages enable row level security;
alter table auth_detection enable row level security;
alter table seo_data enable row level security;
alter table technologies enable row level security;
alter table discoveries enable row level security;
alter table screenshots enable row level security;
alter table app_settings enable row level security;

create policy "authenticated read sites" on sites for select using (auth.role() = 'authenticated');
create policy "authenticated read pages" on pages for select using (auth.role() = 'authenticated');
create policy "authenticated read auth_detection" on auth_detection for select using (auth.role() = 'authenticated');
create policy "authenticated read seo_data" on seo_data for select using (auth.role() = 'authenticated');
create policy "authenticated read technologies" on technologies for select using (auth.role() = 'authenticated');
create policy "authenticated read discoveries" on discoveries for select using (auth.role() = 'authenticated');
create policy "authenticated read screenshots" on screenshots for select using (auth.role() = 'authenticated');
create policy "authenticated read+write app_settings" on app_settings for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
