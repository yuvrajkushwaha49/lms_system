import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import {
  FiBookmark,
  FiChevronDown,
  FiHeart,
  FiMessageCircle,
  FiMoreHorizontal,
  FiPlay,
  FiSend,
  FiShare2,
  FiX,
} from "react-icons/fi";

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function truncate(text, max) {
  const t = String(text || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function AskRyanContent() {
  const [sort, setSort] = useState("latest");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const [questionDraft, setQuestionDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pageNotice, setPageNotice] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [videoModal, setVideoModal] = useState(null);
  const [communityLiked, setCommunityLiked] = useState(false);
  const [communityLikesCount, setCommunityLikesCount] = useState(0);
  const [communityRecentLikers, setCommunityRecentLikers] = useState([]);
  const [commentsById, setCommentsById] = useState({});
  const [commentsLoading, setCommentsLoading] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [expandedComments, setExpandedComments] = useState({});

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  const loadPublished = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoadError("Please sign in to view this page.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setLoadError("");
      const response = await fetch(`${apiBaseUrl}/api/ask-ryan/published?limit=24&offset=0`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Could not load responses.");
      }
      let list = Array.isArray(payload.data) ? payload.data : [];
      if (sort === "oldest") {
        list = [...list].reverse();
      }
      setItems(list);

      const communityLikeResponse = await fetch(`${apiBaseUrl}/api/ask-ryan/community-like`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const communityLikePayload = await communityLikeResponse.json();
      if (communityLikeResponse.ok && communityLikePayload.status === "success") {
        setCommunityLiked(Boolean(communityLikePayload.data?.liked_by_me));
        setCommunityLikesCount(Number(communityLikePayload.data?.likes_count || 0));
        setCommunityRecentLikers(
          Array.isArray(communityLikePayload.data?.recent_likers) ? communityLikePayload.data.recent_likers : [],
        );
      }
    } catch (e) {
      setLoadError(e.message || "Could not load responses.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, sort]);

  const toggleCommunityLike = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    let avatarDataUrl = "";
    try {
      const rawExtras = localStorage.getItem("lms_student_profile_extras_v1");
      const parsedExtras = rawExtras ? JSON.parse(rawExtras) : {};
      avatarDataUrl = String(parsedExtras?.avatarDataUrl || "").trim();
    } catch {
      avatarDataUrl = "";
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/ask-ryan/community-like/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar_data_url: avatarDataUrl || null }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") return;
      setCommunityLiked(Boolean(payload.data?.liked_by_me));
      setCommunityLikesCount(Number(payload.data?.likes_count || 0));
      setCommunityRecentLikers(Array.isArray(payload.data?.recent_likers) ? payload.data.recent_likers : []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadPublished();
    });
  }, [loadPublished]);

  const submitQuestion = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;
    const q = questionDraft.trim();
    if (!q) {
      setSubmitError("Please type your question.");
      return;
    }
    try {
      setSubmitting(true);
      setSubmitError("");
      setPageNotice("");
      const response = await fetch(`${apiBaseUrl}/api/ask-ryan/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question_text: q }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Could not send question.");
      }
      setPageNotice(payload.data?.message || "Your question was submitted.");
      setQuestionDraft("");
      setAskOpen(false);
    } catch (err) {
      setSubmitError(err.message || "Could not send question.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = async (id) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/ask-ryan/questions/${id}/likes/toggle`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") return;
      setItems((prev) =>
        prev.map((row) =>
          String(row.id) === String(id)
            ? {
                ...row,
                is_liked: payload.data.is_liked,
                likes_count: payload.data.likes_count,
              }
            : row,
        ),
      );
    } catch {
      /* ignore */
    }
  };

  const loadComments = async (questionId) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setCommentsLoading((m) => ({ ...m, [questionId]: true }));
    try {
      const response = await fetch(`${apiBaseUrl}/api/ask-ryan/questions/${questionId}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (response.ok && payload.status === "success") {
        setCommentsById((m) => ({ ...m, [questionId]: payload.data || [] }));
      }
    } finally {
      setCommentsLoading((m) => ({ ...m, [questionId]: false }));
    }
  };

  const toggleComments = (questionId) => {
    const key = String(questionId);
    setExpandedComments((prev) => {
      const next = !prev[key];
      if (next) void loadComments(questionId);
      return { ...prev, [key]: next };
    });
  };

  const sendComment = async (questionId) => {
    const token = localStorage.getItem("token");
    const text = String(commentDrafts[questionId] || "").trim();
    if (!token || !text) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/ask-ryan/questions/${questionId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ comment_text: text }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") return;
      setCommentDrafts((d) => ({ ...d, [questionId]: "" }));
      setItems((prev) =>
        prev.map((row) =>
          String(row.id) === String(questionId) ? { ...row, comments_count: payload.data.comments_count } : row,
        ),
      );
      void loadComments(questionId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="ask-ryan-page">
      <div className="ask-ryan-toolbar">
        <h1 className="ask-ryan-toolbar-title">Ask Ryan Anything</h1>
        <div className="ask-ryan-toolbar-actions">
          <label className="ask-ryan-sort">
            <span className="visually-hidden">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort responses">
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
            </select>
            <FiChevronDown className="ask-ryan-sort-chevron" aria-hidden />
          </label>
          <button
            type="button"
            className="ask-ryan-icon-add"
            title="Ask a question"
            onClick={() => {
              setSubmitError("");
              setAskOpen(true);
            }}
          >
            +
          </button>
        </div>
      </div>

      <section className="ask-ryan-hero" aria-label="Ask Ryan introduction">
        <div className="ask-ryan-hero-inner">
          <span className="ask-ryan-hero-badge">Membership</span>
          <h2 className="ask-ryan-hero-heading">Ask Ryan Anything</h2>
          <p className="ask-ryan-hero-sub">
            Want Ryan&apos;s take? Drop your questions below for a personalized video response when your team posts a reply.
          </p>
        </div>
        <div className="ask-ryan-hero-visual" aria-hidden="true" />
      </section>

      <section className="ask-ryan-intro-card lms-card">
        <div className="ask-ryan-intro-head">
          <h3 className="ask-ryan-intro-title">Drop your questions below 👇</h3>
          <div className="ask-ryan-intro-actions">
            <button type="button" className="ask-ryan-intro-icon" aria-label="Bookmark" title="Bookmark">
              <FiBookmark />
            </button>
            <button type="button" className="ask-ryan-intro-icon" aria-label="More" title="More">
              <FiMoreHorizontal />
            </button>
            <button type="button" className="ask-ryan-intro-icon" aria-label="Share" title="Share">
              <FiShare2 />
            </button>
          </div>
        </div>
        <p className="ask-ryan-intro-lede">
          Use this space to ask about mindset, listings, follow-up, burnout, optimism — anything that helps you sell with
          confidence.
        </p>
        <ul className="ask-ryan-intro-bullets">
          <li>How you show up for clients and leads</li>
          <li>Pipeline, discipline, and energy</li>
          <li>Stories and lessons from the field</li>
        </ul>
        <div className="ask-ryan-intro-cta-wrap">
          <button
            type="button"
            className="ask-ryan-intro-cta"
            onClick={() => {
              setSubmitError("");
              setAskOpen(true);
            }}
          >
            Ask Ryan Anything
          </button>
        </div>
        <div className="ask-ryan-intro-foot">
          <button
            type="button"
            className={`ask-ryan-intro-like${communityLiked ? " is-liked" : ""}`}
            aria-label="Like this section"
            aria-pressed={communityLiked}
            onClick={() => void toggleCommunityLike()}
          >
            <FiHeart />
          </button>
          <div className="ask-ryan-intro-like-right">
            {communityRecentLikers.length > 0 && (
              <div className="ask-ryan-intro-like-avatars" aria-hidden>
                {communityRecentLikers.slice(0, 5).map((liker, idx) => (
                  <span
                    key={`${liker?.user_name || "member"}-${idx}`}
                    className="ask-ryan-intro-like-avatar"
                    title={liker?.user_name || "Member"}
                  >
                    {liker?.avatar_data_url ? (
                      <img src={liker.avatar_data_url} alt="" className="ask-ryan-intro-like-avatar-img" />
                    ) : (
                      initials(liker?.user_name)
                    )}
                  </span>
                ))}
              </div>
            )}
            <span className="ask-ryan-intro-likes-label">{communityLikesCount} likes</span>
          </div>
        </div>
      </section>

      {pageNotice && (
        <div className="alert alert-success ask-ryan-alert py-2" role="status">
          {pageNotice}
          <button type="button" className="btn btn-sm btn-link ms-2 p-0" onClick={() => setPageNotice("")}>
            Dismiss
          </button>
        </div>
      )}
      {loadError && <div className="alert alert-danger ask-ryan-alert">{loadError}</div>}

      <section className="ask-ryan-grid-section" aria-label="Video responses">
        {loading ? (
          <p className="ask-ryan-muted">Loading responses…</p>
        ) : items.length === 0 ? (
          <p className="ask-ryan-muted">No replies yet. Be the first to ask a question above.</p>
        ) : (
          <div className="ask-ryan-grid">
            {items.map((row) => (
              <article key={row.id} className="ask-ryan-response-card lms-card">
                <div className="ask-ryan-split">
                  <div className="ask-ryan-split-q">
                    <div className="ask-ryan-bubble">
                      <div className="ask-ryan-bubble-user">
                        <span className="ask-ryan-avatar">{initials(row.user_name)}</span>
                        <span className="ask-ryan-bubble-name">{row.user_name || "Member"}</span>
                      </div>
                      <p className="ask-ryan-bubble-text">{truncate(row.question_text, 220)}</p>
                    </div>
                  </div>
                  {row.response_video_url ? (
                    <button
                      type="button"
                      className="ask-ryan-split-video"
                      onClick={() => setVideoModal(row)}
                      aria-label={`Play video: ${row.response_title}`}
                    >
                      {row.response_thumbnail_url ? (
                        <img src={row.response_thumbnail_url} alt="" className="ask-ryan-thumb-img" />
                      ) : (
                        <div className="ask-ryan-thumb-fallback" />
                      )}
                      <span className="ask-ryan-play-badge">
                        <FiPlay />
                      </span>
                    </button>
                  ) : (
                    <div className="ask-ryan-split-video" aria-label="No reply file uploaded">
                      <div className="ask-ryan-thumb-fallback" />
                    </div>
                  )}
                </div>
                <h4 className="ask-ryan-card-title">{row.response_title}</h4>
                <div className="ask-ryan-card-meta">
                  <button
                    type="button"
                    className={`ask-ryan-meta-btn${row.is_liked ? " is-liked" : ""}`}
                    onClick={() => toggleLike(row.id)}
                    aria-pressed={row.is_liked}
                  >
                    <FiHeart />
                    <span>{row.likes_count}</span>
                  </button>
                  <button type="button" className="ask-ryan-meta-btn" onClick={() => toggleComments(row.id)}>
                    <FiMessageCircle />
                    <span>{row.comments_count}</span>
                  </button>
                </div>
                {expandedComments[String(row.id)] && (
                  <div className="ask-ryan-comments">
                    {commentsLoading[row.id] ? (
                      <p className="ask-ryan-muted small mb-2">Loading comments…</p>
                    ) : (
                      <ul className="ask-ryan-comment-list">
                        {(commentsById[row.id] || []).map((c) => (
                          <li key={c.id}>
                            <strong>{c.user_name}</strong>
                            <span>{c.comment_text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="ask-ryan-comment-form">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Write a comment…"
                        value={commentDrafts[row.id] || ""}
                        onChange={(e) => setCommentDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void sendComment(row.id);
                          }
                        }}
                      />
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => void sendComment(row.id)}>
                        <FiSend size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {askOpen && (
        <div className="ask-ryan-modal-backdrop" role="presentation" onClick={() => !submitting && setAskOpen(false)}>
          <div
            className="ask-ryan-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ask-ryan-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ask-ryan-modal-head">
              <h2 id="ask-ryan-modal-title" className="ask-ryan-modal-title">
                Your question
              </h2>
              <button type="button" className="ask-ryan-modal-close" onClick={() => setAskOpen(false)} aria-label="Close">
                <FiX />
              </button>
            </div>
            <form onSubmit={submitQuestion} className="ask-ryan-modal-body">
              {submitError && <div className="alert alert-danger py-2">{submitError}</div>}
              <textarea
                className="form-control"
                rows={5}
                value={questionDraft}
                onChange={(e) => setQuestionDraft(e.target.value)}
                placeholder="What would you like Ryan to speak to?"
                maxLength={8000}
              />
              <div className="ask-ryan-modal-actions">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setAskOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Sending…" : "Submit question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {videoModal && (
        <div className="ask-ryan-modal-backdrop" role="presentation" onClick={() => setVideoModal(null)}>
          <div className="ask-ryan-video-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ask-ryan-modal-close ask-ryan-video-close" onClick={() => setVideoModal(null)}>
              <FiX />
            </button>
            <h3 className="ask-ryan-video-modal-title">{videoModal.response_title}</h3>
            <video
              className="ask-ryan-video-el"
              controls
              playsInline
              autoPlay
              src={videoModal.response_video_url}
              poster={videoModal.response_thumbnail_url || undefined}
            >
              <track kind="captions" />
            </video>
            <p className="ask-ryan-video-q">
              <strong>{videoModal.user_name} asked:</strong> {videoModal.question_text}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
