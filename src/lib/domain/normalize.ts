/**
 * Normalizes any URL down to a canonical registrable domain, so that
 * https://www.example.com/login, http://example.com/, and
 * https://example.com/register?ref=1 all collapse to the same record
 * ("example.com"). This is what powers duplicate detection (PRD §7, §36).
 */
export function normalizeDomain(rawUrl: string): string | null {
  let url: URL;
  try {
    // Allow bare domains ("example.com") by adding a scheme if missing.
    const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    url = new URL(candidate);
  } catch {
    return null;
  }

  let hostname = url.hostname.toLowerCase().trim();

  // Strip a single leading "www."
  if (hostname.startsWith("www.")) {
    hostname = hostname.slice(4);
  }

  // Strip trailing dot (FQDN notation) and any stray whitespace/punycode edge cases.
  hostname = hostname.replace(/\.$/, "");

  if (!hostname || !hostname.includes(".")) {
    return null;
  }

  return hostname;
}

/**
 * Builds a clean https homepage URL from a normalized domain, used when we
 * only have "example.com" and need somewhere to start crawling.
 */
export function homepageUrlFor(normalizedDomain: string): string {
  return `https://${normalizedDomain}/`;
}

export function isSameDomain(a: string, b: string): boolean {
  const na = normalizeDomain(a);
  const nb = normalizeDomain(b);
  return !!na && !!nb && na === nb;
}
