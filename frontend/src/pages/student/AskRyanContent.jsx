import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import {
  FiArrowLeft,
  FiBookmark,
  FiChevronDown,
  FiHeart,
  FiMaximize2,
  FiMessageCircle,
  FiMinimize2,
  FiMoreHorizontal,
  FiPlay,
  FiSend,
  FiShare2,
  FiX,
} from "react-icons/fi";

const ASK_RYAN_POST_BOOKMARKS_STORAGE_KEY = "student_ask_ryan_post_bookmarks";
const ASK_RYAN_INTRO_BOOKMARK_STORAGE_KEY = "student_ask_ryan_intro_bookmarked";

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

function buildCommentTree(rows) {
  const allRows = Array.isArray(rows) ? rows : [];
  const byId = new Map();
  const roots = [];

  allRows.forEach((row) => {
    byId.set(String(row.id), { ...row, replies: [] });
  });

  byId.forEach((row) => {
    if (row.parent_comment_id == null) {
      roots.push(row);
      return;
    }
    const parent = byId.get(String(row.parent_comment_id));
    if (parent) {
      parent.replies.push(row);
    } else {
      roots.push(row);
    }
  });

  return roots;
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
  const [videoModalId, setVideoModalId] = useState(null);
  const [communityLiked, setCommunityLiked] = useState(false);
  const [communityLikesCount, setCommunityLikesCount] = useState(0);
  const [communityRecentLikers, setCommunityRecentLikers] = useState([]);
  const [commentsById, setCommentsById] = useState({});
  const [commentsLoading, setCommentsLoading] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [modalCommentsOpen, setModalCommentsOpen] = useState(true);
  const [replyOpenByCommentId, setReplyOpenByCommentId] = useState({});
  const [replyDraftsByCommentId, setReplyDraftsByCommentId] = useState({});
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [likesModal, setLikesModal] = useState(null);
  const [likesModalLoading, setLikesModalLoading] = useState(false);
  const [introBookmarked, setIntroBookmarked] = useState(() => {
    try {
      return localStorage.getItem(ASK_RYAN_INTRO_BOOKMARK_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [bookmarkedPostMap, setBookmarkedPostMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(ASK_RYAN_POST_BOOKMARKS_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  });

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  useEffect(() => {
    localStorage.setItem(
      ASK_RYAN_INTRO_BOOKMARK_STORAGE_KEY,
      introBookmarked ? "1" : "0",
    );
  }, [introBookmarked]);

  useEffect(() => {
    localStorage.setItem(
      ASK_RYAN_POST_BOOKMARKS_STORAGE_KEY,
      JSON.stringify(bookmarkedPostMap),
    );
  }, [bookmarkedPostMap]);

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
    let avatarDataUrl = "";
    try {
      const rawExtras = localStorage.getItem("lms_student_profile_extras_v1");
      const parsedExtras = rawExtras ? JSON.parse(rawExtras) : {};
      avatarDataUrl = String(parsedExtras?.avatarDataUrl || "").trim();
    } catch {
      avatarDataUrl = "";
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/ask-ryan/questions/${id}/likes/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar_data_url: avatarDataUrl || null }),
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
                recent_likers: Array.isArray(payload.data.recent_likers) ? payload.data.recent_likers : row.recent_likers,
              }
            : row,
        ),
      );
    } catch {
      /* ignore */
    }
  };

  const openLikesModal = async (row) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLikesModal({ title: row.response_title || "Ask Ryan Anything", likes: [] });
    setLikesModalLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/ask-ryan/questions/${row.id}/likes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") return;
      setLikesModal({
        title: row.response_title || "Ask Ryan Anything",
        likes: Array.isArray(payload.data) ? payload.data : [],
      });
    } finally {
      setLikesModalLoading(false);
    }
  };

  const togglePostBookmark = (postId) => {
    setBookmarkedPostMap((prev) => ({
      ...prev,
      [String(postId)]: !prev[String(postId)],
    }));
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

  const sendComment = async (questionId, parentCommentId = null) => {
    const token = localStorage.getItem("token");
    const text = String(
      parentCommentId == null ? commentDrafts[questionId] || "" : replyDraftsByCommentId[parentCommentId] || "",
    ).trim();
    if (!token || !text) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/ask-ryan/questions/${questionId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          comment_text: text,
          parent_comment_id: parentCommentId,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") return;
      if (parentCommentId == null) {
        setCommentDrafts((d) => ({ ...d, [questionId]: "" }));
      } else {
        setReplyDraftsByCommentId((d) => ({ ...d, [parentCommentId]: "" }));
        setReplyOpenByCommentId((prev) => ({ ...prev, [parentCommentId]: false }));
      }
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

  const sessionUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const selectedVideoModal = useMemo(
    () => items.find((row) => String(row.id) === String(videoModalId)) || null,
    [items, videoModalId],
  );

  const openResponseDetail = (row) => {
    setVideoModalId(row.id);
    setDetailExpanded(false);
    setModalCommentsOpen(true);
    if (!(commentsById[row.id] || []).length) {
      void loadComments(row.id);
    }
  };

  const toggleCommentLike = async (questionId, commentId) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/ask-ryan/questions/${questionId}/comments/${commentId}/likes/toggle`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") return;
      setCommentsById((prev) => ({
        ...prev,
        [questionId]: (prev[questionId] || []).map((comment) =>
          String(comment.id) === String(commentId)
            ? {
                ...comment,
                is_liked: payload.data.is_liked,
                likes_count: payload.data.likes_count,
              }
            : comment,
        ),
      }));
    } catch {
      /* ignore */
    }
  };

  const renderCommentNode = (questionId, comment, depth = 0) => {
    const replies = Array.isArray(comment.replies) ? comment.replies : [];
    const isReplyOpen = Boolean(replyOpenByCommentId[comment.id]);

    return (
      <li key={comment.id} className={depth > 0 ? "ask-ryan-comment-item ask-ryan-comment-item-reply" : "ask-ryan-comment-item"}>
        <div className="ask-ryan-comment-row">
          <span className="ask-ryan-avatar ask-ryan-comment-avatar">{initials(comment.user_name)}</span>
          <div className="ask-ryan-comment-content">
            <div className="ask-ryan-comment-bubble">
              <strong>{comment.user_name}</strong>
              <span>{comment.comment_text}</span>
            </div>
            <button
              type="button"
              className="ask-ryan-comment-reply-btn"
              onClick={() =>
                setReplyOpenByCommentId((prev) => ({
                  ...prev,
                  [comment.id]: !prev[comment.id],
                }))
              }
            >
              Reply
            </button>
            <button
              type="button"
              className={`ask-ryan-comment-like-btn${comment.is_liked ? " is-liked" : ""}`}
              onClick={() => void toggleCommentLike(questionId, comment.id)}
              aria-pressed={comment.is_liked}
            >
              <FiHeart size={13} />
              <span>{comment.likes_count || 0}</span>
            </button>
            {isReplyOpen && (
              <div className="ask-ryan-comment-form ask-ryan-comment-reply-form">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder={`Reply to ${comment.user_name}...`}
                  value={replyDraftsByCommentId[comment.id] || ""}
                  onChange={(e) => setReplyDraftsByCommentId((d) => ({ ...d, [comment.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void sendComment(questionId, comment.id);
                    }
                  }}
                />
                <button type="button" className="btn btn-sm btn-primary" onClick={() => void sendComment(questionId, comment.id)}>
                  <FiSend size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
        {replies.length > 0 && (
          <ul className="ask-ryan-comment-list ask-ryan-comment-replies">
            {replies.map((reply) => renderCommentNode(questionId, reply, depth + 1))}
          </ul>
        )}
      </li>
    );
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
            <button
              type="button"
              className={`ask-ryan-intro-icon ${introBookmarked ? "is-active" : ""}`}
              aria-label={introBookmarked ? "Remove bookmark" : "Bookmark"}
              aria-pressed={introBookmarked}
              title={introBookmarked ? "Remove bookmark" : "Bookmark"}
              onClick={() => setIntroBookmarked((prev) => !prev)}
            >
              <FiBookmark />
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
              <article
                key={row.id}
                className="ask-ryan-response-card lms-card"
                role="button"
                tabIndex={0}
                onClick={() => openResponseDetail(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openResponseDetail(row);
                  }
                }}
              >
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
                      onClick={(event) => {
                        event.stopPropagation();
                        openResponseDetail(row);
                      }}
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
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleLike(row.id);
                    }}
                    aria-pressed={row.is_liked}
                  >
                    <FiHeart />
                    <span>{row.likes_count}</span>
                  </button>
                  <button
                    type="button"
                    className="ask-ryan-meta-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      openResponseDetail(row);
                    }}
                  >
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
                        {buildCommentTree(commentsById[row.id] || []).map((comment) => renderCommentNode(row.id, comment))}
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

      {selectedVideoModal && (
        <div
          className={`ask-ryan-modal-backdrop${detailExpanded ? " ask-ryan-modal-backdrop-expanded" : ""}`}
          role="presentation"
          onClick={() => {
            setVideoModalId(null);
            setDetailExpanded(false);
          }}
        >
          <div
            className={`ask-ryan-video-modal ask-ryan-detail-modal${detailExpanded ? " ask-ryan-detail-modal-expanded" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ask-ryan-detail-head">
              <div className="ask-ryan-detail-head-main">
                {detailExpanded && (
                  <button
                    type="button"
                    className="ask-ryan-detail-back-btn"
                    onClick={() => setDetailExpanded(false)}
                  >
                    <FiArrowLeft />
                    <span>Back to Ask Ryan Anything</span>
                  </button>
                )}
                {!detailExpanded && <h3 className="ask-ryan-video-modal-title">{selectedVideoModal.response_title}</h3>}
              </div>
              <div className="ask-ryan-detail-tools">
                <button
                  type="button"
                  className={`ask-ryan-intro-icon ${bookmarkedPostMap[String(selectedVideoModal.id)] ? "is-active" : ""}`}
                  aria-label={bookmarkedPostMap[String(selectedVideoModal.id)] ? "Remove bookmark" : "Add to bookmark"}
                  aria-pressed={Boolean(bookmarkedPostMap[String(selectedVideoModal.id)])}
                  title={bookmarkedPostMap[String(selectedVideoModal.id)] ? "Remove bookmark" : "Add to bookmark"}
                  onClick={() => togglePostBookmark(selectedVideoModal.id)}
                >
                  <FiBookmark />
                </button>
                <button
                  type="button"
                  className="ask-ryan-intro-icon"
                  aria-label={detailExpanded ? "Exit expanded view" : "Expand"}
                  title={detailExpanded ? "Exit expanded view" : "Expand"}
                  onClick={() => setDetailExpanded((prev) => !prev)}
                >
                  {detailExpanded ? <FiMinimize2 /> : <FiMaximize2 />}
                </button>
                <button
                  type="button"
                  className="ask-ryan-modal-close ask-ryan-video-close"
                  onClick={() => {
                    setVideoModalId(null);
                    setDetailExpanded(false);
                  }}
                  aria-label="Close"
                >
                  <FiX />
                </button>
              </div>
            </div>
            <div className="ask-ryan-detail-scroll">
              <video
                className="ask-ryan-video-el"
                controls
                playsInline
                autoPlay
                src={selectedVideoModal.response_video_url}
                poster={selectedVideoModal.response_thumbnail_url || undefined}
              >
                <track kind="captions" />
              </video>
              <div className="ask-ryan-detail-copy">
                <p className="ask-ryan-video-q mb-2">
                  <a href="#ask-ryan-author" className="ask-ryan-detail-author-link">
                    {selectedVideoModal.user_name || "Member"}
                  </a>{" "}
                  {!!selectedVideoModal.question_text && selectedVideoModal.question_text}
                </p>
                <p className="ask-ryan-detail-tag mb-0">#Ask Ryan Anything</p>
              </div>
              <div className="ask-ryan-detail-stats">
                <div className="ask-ryan-detail-stats-left">
                  <button
                    type="button"
                    className={`ask-ryan-meta-btn${selectedVideoModal.is_liked ? " is-liked" : ""}`}
                    onClick={() => void toggleLike(selectedVideoModal.id)}
                    aria-pressed={selectedVideoModal.is_liked}
                  >
                    <FiHeart />
                    <span>{selectedVideoModal.likes_count || 0}</span>
                  </button>
                  <button
                    type="button"
                    className="ask-ryan-meta-btn"
                    onClick={() => {
                      setModalCommentsOpen((prev) => {
                        const next = !prev;
                        if (next && !(commentsById[selectedVideoModal.id] || []).length) {
                          void loadComments(selectedVideoModal.id);
                        }
                        return next;
                      });
                    }}
                  >
                    <FiMessageCircle />
                    <span>{selectedVideoModal.comments_count || 0}</span>
                  </button>
                </div>
                <div className="ask-ryan-detail-stats-right">
                  <button
                    type="button"
                    className="ask-ryan-detail-likes-trigger"
                    onClick={() => void openLikesModal(selectedVideoModal)}
                  >
                    {Array.isArray(selectedVideoModal.recent_likers) && selectedVideoModal.recent_likers.length > 0 && (
                      <span className="ask-ryan-detail-like-avatars" aria-hidden>
                        {selectedVideoModal.recent_likers.slice(0, 5).map((liker, idx) => (
                          <span
                            key={`${liker?.user_name || "member"}-${idx}`}
                            className="ask-ryan-detail-like-avatar"
                            title={liker?.user_name || "Member"}
                          >
                            {liker?.avatar_data_url ? (
                              <img src={liker.avatar_data_url} alt="" className="ask-ryan-intro-like-avatar-img" />
                            ) : (
                              initials(liker?.user_name)
                            )}
                          </span>
                        ))}
                      </span>
                    )}
                    <span>{selectedVideoModal.likes_count || 0} likes</span>
                  </button>
                  <span>{selectedVideoModal.comments_count || 0} comments</span>
                </div>
              </div>
              <div className="ask-ryan-detail-author" id="ask-ryan-author">
                <span className="ask-ryan-avatar">{initials(selectedVideoModal.user_name || sessionUser?.name)}</span>
                <div>
                  <strong>{selectedVideoModal.user_name || "Member"}</strong>
                  <div className="ask-ryan-detail-role">Founder & CEO</div>
                </div>
              </div>
              {modalCommentsOpen && (
                <div className="ask-ryan-detail-comments">
                  {commentsLoading[selectedVideoModal.id] ? (
                    <p className="ask-ryan-muted small mb-3">Loading comments…</p>
                  ) : (commentsById[selectedVideoModal.id] || []).length > 0 ? (
                    <ul className="ask-ryan-comment-list ask-ryan-detail-comment-list">
                      {buildCommentTree(commentsById[selectedVideoModal.id] || []).map((comment) =>
                        renderCommentNode(selectedVideoModal.id, comment),
                      )}
                    </ul>
                  ) : (
                    <p className="ask-ryan-muted small mb-3">No comments yet.</p>
                  )}
                </div>
              )}
            </div>
            <div className="ask-ryan-detail-compose">
              <span className="ask-ryan-avatar ask-ryan-detail-compose-avatar">
                {initials(sessionUser?.name || "U")}
              </span>
              <div className="ask-ryan-comment-form ask-ryan-detail-comment-form">
                <input
                  type="text"
                  className="form-control"
                  placeholder="What are your thoughts?"
                  value={commentDrafts[selectedVideoModal.id] || ""}
                  onChange={(e) => setCommentDrafts((d) => ({ ...d, [selectedVideoModal.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void sendComment(selectedVideoModal.id);
                    }
                  }}
                />
                <button type="button" className="btn btn-primary" onClick={() => void sendComment(selectedVideoModal.id)}>
                  <FiSend size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {likesModal && (
        <div className="ask-ryan-modal-backdrop" role="presentation" onClick={() => setLikesModal(null)}>
          <div className="ask-ryan-likes-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ask-ryan-likes-modal-head">
              <h3 className="ask-ryan-likes-modal-title">{likesModal.likes.length} Likes</h3>
              <button type="button" className="ask-ryan-modal-close" onClick={() => setLikesModal(null)} aria-label="Close">
                <FiX />
              </button>
            </div>
            <div className="ask-ryan-likes-modal-body">
              {likesModalLoading ? (
                <p className="ask-ryan-muted mb-0">Loading likes…</p>
              ) : likesModal.likes.length > 0 ? (
                <ul className="ask-ryan-likes-list">
                  {likesModal.likes.map((liker, idx) => (
                    <li key={`${liker.user_id || liker.user_name}-${idx}`} className="ask-ryan-likes-item">
                      <span className="ask-ryan-likes-avatar">
                        {liker.avatar_data_url ? (
                          <img src={liker.avatar_data_url} alt="" className="ask-ryan-intro-like-avatar-img" />
                        ) : (
                          initials(liker.user_name)
                        )}
                      </span>
                      <span className="ask-ryan-likes-name">{liker.user_name || "Member"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ask-ryan-muted mb-0">No likes yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
