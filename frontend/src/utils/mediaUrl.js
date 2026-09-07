/**
 * Turn API-stored media URLs into something the browser can load from the SPA origin.
 * - Relative paths (/uploads/..., /api/...) are prefixed with apiBaseUrl (Vite proxy in dev).
 * - Absolute http(s) URLs under /uploads/ or /api/ are re-based onto apiBaseUrl / page origin
 *   so a wrong microservice host (e.g. http://127.0.0.1:5004/...) still works via the gateway.
 */
export function resolvePublicMediaUrl(url, apiBaseUrl) {
  const trimmed = String(url ?? "").trim();
  if (!trimmed) return "";

  const head = trimmed.slice(0, 5).toLowerCase();
  if (head.startsWith("data:") || head.startsWith("blob:")) return trimmed;

  const base = String(apiBaseUrl ?? "").replace(/\/$/, "");

  if (trimmed.startsWith("//")) {
    if (typeof window !== "undefined" && window.location?.protocol) {
      return `${window.location.protocol}${trimmed}`;
    }
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith("/")) {
    return base ? `${base}${trimmed}` : trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const isAppPath =
        parsed.pathname.startsWith("/uploads/") || parsed.pathname.startsWith("/api/");
      if (isAppPath) {
        if (base) {
          const originBase = base.match(/^https?:\/\//i) ? base : `http://${base}`;
          const api = new URL(originBase);
          return `${api.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
        if (typeof window !== "undefined" && window.location?.origin) {
          return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }

  if (base && !trimmed.includes("://")) {
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${base}${path}`;
  }

  return trimmed;
}
