/**
 * Base URL for REST calls and resolvePublicMediaUrl().
 * - In Vite dev (default): returns "" so /api and /uploads are proxied to the API gateway (port 5000).
 * - Set VITE_DEV_PROXY=0 to call VITE_API_BASE_URL directly in dev.
 * - Production: VITE_API_BASE_URL or http://localhost:5000 (API gateway).
 */
export function getApiBaseUrl() {
  const devProxyOff = String(import.meta.env.VITE_DEV_PROXY || "").trim() === "0";
  if (import.meta.env.DEV && !devProxyOff) {
    return "";
  }
  const raw = import.meta.env.VITE_API_BASE_URL;
  const s = raw == null ? "" : String(raw).trim();
  if (s) return s.replace(/\/$/, "");
  return "http://localhost:5000";
}
