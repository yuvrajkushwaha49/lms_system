import { useCallback, useEffect, useMemo, useState } from "react";
import { FiBookmark, FiMoreHorizontal, FiShare2, FiStar } from "react-icons/fi";
import { resolveWelcomeVideoPresentation } from "../../utils/welcomeVideoEmbed";

const CARD_TITLE = "Welcome to the Sell It family! 💙";

/**
 * Welcome video block (hero + card) — used inside Start Here and legacy welcome route.
 */
export default function WelcomeFamilyVideoInner({ showHero = true }) {
  const [data, setData] = useState({
    video_url: "",
    thumbnail_url: "",
    video_caption: "",
    body_text: "",
    transcript_text: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || "http://localhost:5003").replace(/\/$/, ""),
    [],
  );

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/welcome-video`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to load welcome content.");
      }
      setData({
        video_url: payload.data?.video_url || "",
        thumbnail_url: payload.data?.thumbnail_url || "",
        video_caption: payload.data?.video_caption || "",
        body_text: payload.data?.body_text || "",
        transcript_text: payload.data?.transcript_text || "",
      });
    } catch (e) {
      setError(e.message || "Unable to load welcome content.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const id = window.setTimeout(load, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const videoPresentation = useMemo(
    () => resolveWelcomeVideoPresentation(data.video_url),
    [data.video_url],
  );

  const bodyParagraphs = useMemo(() => {
    const t = String(data.body_text || "").trim();
    if (!t) return [];
    return t
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [data.body_text]);

  return (
    <div className="container-fluid px-0 welcome-family-page" style={{ maxWidth: 1040 }}>
      {showHero && (
        <section className="welcome-family-hero mb-4">
          <div className="welcome-family-hero-left">
            <span className="welcome-family-badge">MEMBERSHIP</span>
            <h1 className="welcome-family-hero-title">WELCOME TO YOUR NEW COMMUNITY!</h1>
            <p className="welcome-family-hero-sub mb-0">
              Everything you need to get started in one place.
            </p>
          </div>
          <div className="welcome-family-hero-right" aria-hidden="true" />
        </section>
      )}

      {error && <div className="alert alert-danger mb-3">{error}</div>}

      <div className="lms-card welcome-family-card overflow-hidden">
        <div className="welcome-family-card-head">
          <h2 className="welcome-family-card-title mb-0">{CARD_TITLE}</h2>
          <div className="welcome-family-card-actions">
            <button type="button" className="welcome-family-icon-btn" aria-label="AI assist" title="AI assist">
              <FiStar size={18} />
            </button>
            <button type="button" className="welcome-family-icon-btn" aria-label="Bookmark" title="Bookmark">
              <FiBookmark size={18} />
            </button>
            <button type="button" className="welcome-family-icon-btn" aria-label="More" title="More">
              <FiMoreHorizontal size={18} />
            </button>
            <button type="button" className="welcome-family-icon-btn" aria-label="Share" title="Share">
              <FiShare2 size={18} />
            </button>
          </div>
        </div>

        <div className="welcome-family-video-wrap">
          {isLoading ? (
            <div className="welcome-family-video-placeholder text-muted">Loading video…</div>
          ) : videoPresentation.type === "youtube" ? (
            <div className="ratio ratio-16x9">
              <iframe
                title="Welcome video"
                src={`${videoPresentation.embedUrl}?rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : videoPresentation.type === "file" ? (
            <video
              className="welcome-family-video-el"
              controls
              playsInline
              src={videoPresentation.src}
              poster={String(data.thumbnail_url || "").trim() || undefined}
            >
              <track kind="captions" />
            </video>
          ) : (
            <div className="welcome-family-video-placeholder text-muted">
              No video has been published yet. Check back soon.
            </div>
          )}
        </div>

        {Boolean(data.video_caption) && (
          <p className="welcome-family-caption px-4 pt-3 mb-0 text-secondary">{data.video_caption}</p>
        )}

        {Boolean(data.transcript_text) && (
          <div className="px-4 pt-2">
            <button
              type="button"
              className="btn btn-link p-0 welcome-family-transcript-toggle"
              onClick={() => setShowTranscript((v) => !v)}
            >
              {showTranscript ? "Hide transcript" : "Show transcript"}
            </button>
            {showTranscript && (
              <div className="welcome-family-transcript mt-2 text-secondary">{data.transcript_text}</div>
            )}
          </div>
        )}

        <div className="welcome-family-body px-4 pb-4 pt-3">
          {bodyParagraphs.length === 0 ? (
            <p className="text-muted mb-0 small">
              Your admin can add supporting text below the video from the Welcome video management page.
            </p>
          ) : (
            bodyParagraphs.map((para, i) => (
              <p key={i} className="welcome-family-body-para mb-3">
                {para}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
