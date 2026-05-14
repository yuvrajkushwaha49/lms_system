/**
 * Turn API-stored media URLs into something the browser can load from the SPA origin.
 * - Relative paths (/uploads/...) are prefixed with apiBaseUrl (Vite dev on :5173 cannot serve /uploads).
 * - Absolute http(s) URLs under /uploads/ are re-based onto apiBaseUrl origin so a wrong host/port
 *   (e.g. stored http://localhost:5000/... while the app calls :5003) still works.
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

  if (/^https?:\/\//i.test(trimmed) && base) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname.startsWith("/uploads/")) {
        const originBase = base.match(/^https?:\/\//i) ? base : `http://${base}`;
        const api = new URL(originBase);
        return `${api.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
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
