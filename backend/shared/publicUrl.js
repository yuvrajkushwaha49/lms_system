/**
 * Public URLs for browsers must hit the API gateway (or Vite proxy), never an
 * internal microservice host:port (e.g. 127.0.0.1:5004).
 *
 * Prefer PUBLIC_API_BASE_URL when set; otherwise return a root-relative path
 * so the SPA origin / Vite proxy / gateway can serve it.
 */
function getPublicApiBase() {
  const raw = String(process.env.PUBLIC_API_BASE_URL || process.env.API_PUBLIC_URL || '').trim();
  return raw.replace(/\/$/, '');
}

function toPublicUrl(pathname) {
  const path = String(pathname || '');
  if (!path) return '';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const base = getPublicApiBase();
  return base ? `${base}${normalized}` : normalized;
}

function toPublicUploadUrl(relativePath) {
  const clean = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  return toPublicUrl(`/uploads/${clean}`);
}

module.exports = {
  getPublicApiBase,
  toPublicUrl,
  toPublicUploadUrl,
};
