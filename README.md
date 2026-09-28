# NicheScout

Niche site discovery & intelligence platform — discovers newly appearing
gambling/game-related websites from public search results, checks for public
login/registration flows, collects public SEO/tech metadata, and alerts you
on Telegram. Built to run entirely on free tiers.

**Before you deploy this anywhere:** discovering unlicensed gambling/betting
operators and their registration flows sits in a legally sensitive area in
many jurisdictions. Make sure how you use this tool's output is legal where
you are and where the sites operate. The crawler itself only reads public
pages — it never logs in, never submits forms, never bypasses CAPTCHA/OTP,
and respects `robots.txt`. Keep it that way if you extend it.

## Stack (all free tier)

| Piece | Service | Free tier |
|---|---|---|
| Frontend/dashboard | Next.js on **Vercel** | Hobby plan |
| Database | **Supabase** Postgres | Free project |
| Scheduled discovery | **GitHub Actions** cron | Unlimited (public repo) / 2,000 min/mo (private) |
| Alerts | **Telegram Bot API** | Free |
| Search provider | **Tavily** (default) | ~1,000 queries/month, no card |

> Search-provider free tiers change often (Brave dropped its free tier in
> Feb 2026, Bing's API is being retired, Google's Custom Search JSON API is
> free but capped at 100/day and scheduled for shutdown Jan 2027). Check
> `src/lib/discovery/search-providers.ts` before you rely on pricing — swap
> in a different adapter if needed, the interface is deliberately small.

## 1. Supabase setup

1. Create a free project at supabase.com.
2. Open the SQL Editor and run `supabase/schema.sql` from this repo.
3. Go to Authentication → Users and manually create your one admin account
   (email + password). There is no public signup screen by design (PRD §30).
4. Grab your Project URL, `anon` key, and `service_role` key from
   Project Settings → API.

## 2. Telegram bot setup

1. Message **@BotFather** on Telegram → `/newbot` → follow the prompts → copy
   the bot token.
2. Message your new bot once (or add it to a channel/group).
3. Get your chat ID: visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
   after messaging the bot, and read `message.chat.id` from the JSON.

## 3. Search provider

Sign up at tavily.com (free, no card) and grab an API key. Or switch
`SEARCH_PROVIDER` to `google_cse` and set `GOOGLE_CSE_ID` + a Google API key
if you'd rather use Programmable Search Engine.

## 4. Local setup

```bash
npm install
cp .env.example .env.local   # fill in all values
npm run dev
```

Visit `http://localhost:3000`, sign in with the admin account you created in
Supabase, and you should see an empty dashboard (no sites yet — that's
expected until discovery runs).

## 5. Deploy the dashboard to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel → set all the `.env.example` variables as Environment
   Variables (Production + Preview) in Project Settings → Environment
   Variables. **Never** put `SUPABASE_SERVICE_ROLE_KEY` or
   `TELEGRAM_BOT_TOKEN` in a `NEXT_PUBLIC_*` variable — they must stay
   server-only.
3. Deploy. Set `NEXT_PUBLIC_APP_URL` to your deployed URL once you have it
   (used to build the "Open Dashboard" link in Telegram alerts).

## 6. Set up the scheduled discovery worker

This runs as a **GitHub Actions** job (`.github/workflows/discovery.yml`),
not on Vercel — it avoids Vercel's serverless function time limit and stays
fully within GitHub's free minutes.

1. In your GitHub repo: Settings → Secrets and variables → Actions → New
   repository secret. Add all of:
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SEARCH_PROVIDER`,
   `SEARCH_PROVIDER_API_KEY`, `NEXT_PUBLIC_APP_URL`.
2. The workflow runs every 6 hours by default (`cron: "0 */6 * * *"`) — edit
   that line to change frequency. You can also trigger it manually from the
   Actions tab (`workflow_dispatch`).
3. In the dashboard, go to **Settings** and tick which niche categories are
   active — the worker reads this from the database on every run, so you
   don't need to redeploy to change what it looks for.

## 7. First run

Trigger the workflow manually once (Actions tab → NicheScout Discovery → Run
workflow) rather than waiting 6 hours, so you can confirm it's wired up
correctly. Check the job logs for the JSON summary it prints, then refresh
your dashboard.

## What's in the MVP vs. what's V2

Implemented (PRD §42 MUST HAVE): auth, dashboard, niche config, discovery
engine, domain normalization + dedup, crawling within safety limits, login/
registration detection + field extraction, SEO metadata, sitemap/robots
detection, best-effort tech detection, Telegram alerts, site detail page,
search/filter, CSV/JSON export, discovery history.

Not implemented yet (PRD §42 V2, intentionally deferred): screenshot
capture, additional discovery providers, historical change tracking/diffing,
technology-change alerts, domain age lookups, site-similarity detection,
scheduled email/PDF reports. The database schema already has a `screenshots`
table reserved so adding that later won't require a migration.

## Safety boundaries this code will not cross

These aren't configurable — they're hard-coded into how the crawler and
engine work, per the PRD's own rules (§37, §43):

- Respects `robots.txt` `Disallow` and `Crawl-delay`.
- Never submits any form (login, registration, or otherwise).
- Never attempts to bypass CAPTCHA, OTP, or any access control.
- Never brute-forces credentials or creates accounts on third-party sites.
- Only reads pages an anonymous visitor could reach.
- Caps pages/domain, crawl depth, and per-page timeout (all configurable,
  but always enforced).
