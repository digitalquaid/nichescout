export type Category =
  | "Gambling"
  | "Casino"
  | "Game Platform"
  | "Game APK"
  | "Betting"
  | "Gaming"
  | "Unknown"
  | "Irrelevant";

export interface PageAnalysis {
  url: string;
  pageType:
    | "home"
    | "login"
    | "register"
    | "games"
    | "download"
    | "about"
    | "contact"
    | "faq"
    | "privacy"
    | "terms"
    | "blog"
    | "other";
  title: string | null;
  h1: string | null;
  metaDescription: string | null;
  statusCode: number | null;
  html: string;
}

export interface AuthDetectionResult {
  loginDetected: boolean;
  loginUrl: string | null;
  registerDetected: boolean;
  registerUrl: string | null;
  registrationFormDetected: boolean;
  loginFields: string[];
  registrationFields: string[];
  otpDetected: boolean;
  captchaDetected: boolean;
  registrationLevel: 0 | 1 | 2 | 3 | 4;
}

export interface SeoResult {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  language: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  sitemapDetected: boolean;
  robotsDetected: boolean;
}

export interface TechResult {
  technology: string;
  category: "cms" | "frontend" | "server" | "analytics" | "tag_manager" | "cdn" | "js_library" | "other";
  confidence: "best_effort" | "likely" | "unknown";
}

export interface ClassificationResult {
  category: Category;
  confidence: number; // 0..1
  matchedSignals: string[];
}

export interface DiscoveredCandidate {
  url: string;
  source: string;
  sourceQuery: string;
}

export interface CrawlResult {
  homepage: PageAnalysis;
  internalPages: PageAnalysis[];
  httpsEnabled: boolean;
  httpStatus: number | null;
}

export interface NotificationFilters {
  new_domain: boolean;
  registration_detected: boolean;
  login_detected: boolean;
  both_login_and_registration: boolean;
  high_relevance: boolean;
  sitemap_detected: boolean;
  apk_download_section: boolean;
}
