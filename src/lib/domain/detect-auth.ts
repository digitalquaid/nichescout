import * as cheerio from "cheerio";
import type { PageAnalysis, AuthDetectionResult } from "@/lib/types";

const LOGIN_LINK_TEXT = ["login", "log in", "sign in", "signin", "member login", "account"];
const LOGIN_URL_PATTERNS = [/\/login/i, /\/signin/i, /\/sign-in/i, /\/account/i, /\/member/i];

const REGISTER_LINK_TEXT = ["register", "registration", "sign up", "signup", "create account", "join now"];
const REGISTER_URL_PATTERNS = [/\/register/i, /\/registration/i, /\/signup/i, /\/sign-up/i, /\/create-account/i];

const REGISTRATION_FIELD_MAP: Array<{ label: string; patterns: RegExp[] }> = [
  { label: "Username", patterns: [/username/i, /user[_-]?name/i] },
  { label: "Email", patterns: [/email/i] },
  { label: "Phone", patterns: [/phone/i, /mobile/i] },
  { label: "Password", patterns: [/^password$/i, /^pass$/i] },
  { label: "Confirm Password", patterns: [/confirm.?password/i, /re.?password/i, /retype/i] },
  { label: "Referral Code", patterns: [/referral/i, /invite.?code/i, /promo.?code/i] },
  { label: "OTP", patterns: [/otp/i, /verification.?code/i, /verify.?code/i] },
];

const LOGIN_FIELD_MAP: Array<{ label: string; patterns: RegExp[] }> = [
  { label: "Username / Phone", patterns: [/username/i, /user[_-]?name/i, /phone/i, /mobile/i, /account/i] },
  { label: "Email", patterns: [/email/i] },
  { label: "Password", patterns: [/^password$/i, /^pass$/i] },
  { label: "OTP", patterns: [/otp/i, /verification.?code/i] },
  { label: "Remember Me", patterns: [/remember/i] },
];

function fieldIdentity($input: cheerio.Cheerio<any>): string {
  return [
    $input.attr("name"),
    $input.attr("id"),
    $input.attr("placeholder"),
    $input.attr("aria-label"),
    $input.attr("type"),
  ]
    .filter(Boolean)
    .join(" ");
}

function detectFields(html: string, map: Array<{ label: string; patterns: RegExp[] }>): string[] {
  const $ = cheerio.load(html);
  const found = new Set<string>();

  $("input, select, textarea").each((_, el) => {
    const identity = fieldIdentity($(el));
    if (!identity) return;
    for (const { label, patterns } of map) {
      if (patterns.some((p) => p.test(identity))) {
        found.add(label);
      }
    }
  });

  return Array.from(found);
}

function detectCaptcha(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("recaptcha") ||
    lower.includes("g-recaptcha") ||
    lower.includes("hcaptcha") ||
    lower.includes("turnstile") ||
    lower.includes("captcha")
  );
}

function detectOtpOnPage(html: string): boolean {
  const lower = html.toLowerCase();
  return lower.includes("otp") || lower.includes("verification code") || lower.includes("verify code");
}

function findLinkByText(html: string, texts: string[]): string | null {
  const $ = cheerio.load(html);
  let found: string | null = null;

  $("a, button").each((_, el) => {
    if (found) return;
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr("href");
    if (text && texts.some((t) => text.includes(t))) {
      found = href ?? "#";
    }
  });

  return found;
}

function findLinkByUrlPattern(html: string, patterns: RegExp[]): string | null {
  const $ = cheerio.load(html);
  let found: string | null = null;

  $("a[href]").each((_, el) => {
    if (found) return;
    const href = $(el).attr("href") ?? "";
    if (patterns.some((p) => p.test(href))) {
      found = href;
    }
  });

  return found;
}

/**
 * Detects login/registration presence and, where a dedicated login/register
 * page was crawled, inspects its form fields. Implements PRD §9–§13.
 * This NEVER submits a form, brute-forces credentials, or bypasses CAPTCHA —
 * it only reads publicly rendered HTML.
 */
export function detectAuth(homepage: PageAnalysis, internalPages: PageAnalysis[]): AuthDetectionResult {
  const homepageHtml = homepage.html;

  const loginUrl =
    findLinkByText(homepageHtml, LOGIN_LINK_TEXT) ?? findLinkByUrlPattern(homepageHtml, LOGIN_URL_PATTERNS);
  const registerUrl =
    findLinkByText(homepageHtml, REGISTER_LINK_TEXT) ?? findLinkByUrlPattern(homepageHtml, REGISTER_URL_PATTERNS);

  const loginPage = internalPages.find((p) => p.pageType === "login");
  const registerPage = internalPages.find((p) => p.pageType === "register");

  const loginFields = loginPage ? detectFields(loginPage.html, LOGIN_FIELD_MAP) : [];
  const registrationFields = registerPage ? detectFields(registerPage.html, REGISTRATION_FIELD_MAP) : [];

  const registrationFormDetected = !!registerPage && registrationFields.length > 0;
  const hasSubmitMechanism =
    !!registerPage && cheerio.load(registerPage.html)("form").length > 0;

  const otpDetected =
    registrationFields.includes("OTP") ||
    loginFields.includes("OTP") ||
    (registerPage ? detectOtpOnPage(registerPage.html) : false);

  const captchaDetected =
    (registerPage ? detectCaptcha(registerPage.html) : false) ||
    (loginPage ? detectCaptcha(loginPage.html) : false);

  // Registration maturity levels, PRD §13:
  // 1=page exists, 2=real form with fields, 3=has a submit mechanism, 4=verification required.
  let registrationLevel: 0 | 1 | 2 | 3 | 4 = 0;
  if (registerUrl || registerPage) registrationLevel = 1;
  if (registrationFormDetected) registrationLevel = 2;
  if (registrationFormDetected && hasSubmitMechanism) registrationLevel = 3;
  if (registrationLevel >= 2 && (otpDetected || captchaDetected)) registrationLevel = 4;

  return {
    loginDetected: !!loginUrl || !!loginPage,
    loginUrl: loginUrl ?? (loginPage ? loginPage.url : null),
    registerDetected: !!registerUrl || !!registerPage,
    registerUrl: registerUrl ?? (registerPage ? registerPage.url : null),
    registrationFormDetected,
    loginFields,
    registrationFields,
    otpDetected,
    captchaDetected,
    registrationLevel,
  };
}
