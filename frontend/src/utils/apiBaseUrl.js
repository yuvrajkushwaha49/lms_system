/**
 * Base URL for REST calls and resolvePublicMediaUrl().
 * - In Vite dev with VITE_DEV_PROXY=1, returns "" so requests use the SPA origin and
 *   vite.config.js proxies /api and /uploads to the Node server (avoids net::ERR_CONNECTION_REFUSED
 *   when VITE_API_BASE_URL points at an old LAN IP or the backend only listens on localhost).
 * - In production, uses VITE_API_BASE_URL when set, otherwise http://localhost:5003.
 */
export function getApiBaseUrl() {
  if (import.meta.env.DEV && String(import.meta.env.VITE_DEV_PROXY || "").trim() === "1") {
    return "";
  }
  const raw = import.meta.env.VITE_API_BASE_URL;
  const s = raw == null ? "" : String(raw).trim();
  if (s) return s.replace(/\/$/, "");
  return "http://localhost:5173";
}
