interface SiteForNotification {
  domain: string;
  category: string;
  firstSeenAt: string; // ISO
  loginDetected: boolean;
  registerDetected: boolean;
  registrationFormDetected: boolean;
  otpDetected: boolean;
  captchaDetected: boolean;
  httpsEnabled: boolean;
  pageCount: number;
}

function tick(value: boolean): string {
  return value ? "✓" : "No";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    })
    .replace(",", " —");
}

function buildMessage(site: SiteForNotification, dashboardUrl: string): string {
  return [
    "🚨 NEW SITE DETECTED",
    "",
    `Domain:\n${site.domain}`,
    "",
    `Category:\n${site.category}`,
    "",
    `First Seen:\n${formatDate(site.firstSeenAt)}`,
    "",
    `Login:\n${tick(site.loginDetected)}`,
    "",
    `Registration:\n${tick(site.registerDetected)}`,
    "",
    `Registration Form:\n${tick(site.registrationFormDetected)}`,
    "",
    `OTP:\n${tick(site.otpDetected)}`,
    "",
    `Captcha:\n${tick(site.captchaDetected)}`,
    "",
    `HTTPS:\n${tick(site.httpsEnabled)}`,
    "",
    `Pages:\n${site.pageCount}`,
    "",
    "━━━━━━━━━━━━━━",
    "",
    `🔗 Open Website: https://${site.domain}`,
    `🔗 Open Dashboard: ${dashboardUrl}`,
  ].join("\n");
}

export async function sendTelegramAlert(site: SiteForNotification): Promise<void> {
  const enabled = (process.env.TELEGRAM_ALERTS_ENABLED ?? "true").toLowerCase() === "true";
  if (!enabled) return;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing) — skipping alert.");
    return;
  }

  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/sites/${site.domain}`
    : `https://your-dashboard.vercel.app/sites/${site.domain}`;

  const text = buildMessage(site, dashboardUrl);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });

  if (!res.ok) {
    console.error("Telegram send failed:", await res.text());
  }
}
