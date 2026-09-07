import { getApiBaseUrl } from "./apiBaseUrl";
import { resolvePublicMediaUrl } from "./mediaUrl";

/** @returns {{ type: 'youtube', embedUrl: string } | { type: 'file', src: string } | { type: 'none' }} */
export function resolveWelcomeVideoPresentation(url) {
  const raw = String(url || "").trim();
  if (!raw) return { type: "none" };

  const embedMatch = raw.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (embedMatch) {
    return { type: "youtube", embedUrl: `https://www.youtube.com/embed/${embedMatch[1]}` };
  }
  const watch = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  if (watch) {
    return { type: "youtube", embedUrl: `https://www.youtube.com/embed/${watch[1]}` };
  }

  const looksLikeFile =
    /\.(mp4|webm|ogg)(\?|#|$)/i.test(raw) ||
    /\/uploads\/welcome-video\//i.test(raw);

  if (!looksLikeFile) return { type: "none" };

  const src = resolvePublicMediaUrl(raw, getApiBaseUrl());
  return src ? { type: "file", src } : { type: "none" };
}
