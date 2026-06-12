import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiBookmark,
  FiHeart,
  FiMaximize2,
  FiMoreHorizontal,
  FiX,
} from "react-icons/fi";
import CourseAdaptiveVideo from "./CourseAdaptiveVideo";
import { resolvePublicMediaUrl } from "../utils/mediaUrl";
import { CommentListSkeleton } from "./skeletons/LoadingSkeletons";

const DEFAULT_SUBTITLE = "Based on Ryan's Best-Selling Book";

/** Root-level comments only (replies stay under each loaded root). */
const COMMENT_ROOT_PAGE_SIZE = 8;

/** First lesson row from GET /courses/:id/videos — pick a playable URL (main fields or ready variant). */
function resolveSignaturePreviewPlayUrl(video, apiBaseUrl) {
  if (!video) return "";
  if (String(video.content_type || "video").toLowerCase() !== "video") return "";
  const tryResolve = (u) => {
    const s = String(u ?? "").trim();
    return s ? resolvePublicMediaUrl(s, apiBaseUrl) : "";
  };
  for (const key of ["video_url", "video_data_url", "session_video_url"]) {
    const resolved = tryResolve(video[key]);
    if (resolved) return resolved;
  }
  const variants = Array.isArray(video.video_variants) ? video.video_variants : [];
  const ready = variants.find((v) => v.status === "ready" && String(v.media_url || "").trim());
  const any = variants.find((v) => String(v.media_url || "").trim());
  const vUrl = ready?.media_url || any?.media_url || "";
  return tryResolve(vUrl);
}

function commentAuthorName(comment) {
  return String(comment?.user_name || "Member").trim() || "Member";
}

function filterBlockedCommentTree(nodes, canModerate) {
  return (nodes || [])
    .filter((n) => canModerate || !n.is_blocked)
    .map((n) => ({
      ...n,
      replies: filterBlockedCommentTree(n.replies || [], canModerate),
    }));
}

function collectCommentAuthorInitials(nodes, limit = 4) {
  const seen = new Set();
  const out = [];
  const walk = (list) => {
    (list || []).forEach((n) => {
      if (out.length >= limit) return;
      const name = commentAuthorName(n);
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(name.charAt(0).toUpperCase() || "?");
      }
      walk(n.replies || []);
    });
  };
  walk(nodes);
  return out;
}

export default function SignatureCoursePreviewModal({
  open,
  course,
  firstVideo = null,
  heroImageUrl,
  apiBaseUrl,
  isBookmarked,
  onClose,
  onStartCourse,
  onToggleBookmark,
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreWrapRef = useRef(null);
  const commentsScrollRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);

  const [engageLoading, setEngageLoading] = useState(false);
  const [engageErr, setEngageErr] = useState("");
  const [videoLikes, setVideoLikes] = useState({ count: 0, liked: false });
  const [commentRoots, setCommentRoots] = useState([]);
  const [rootDraft, setRootDraft] = useState("");
  const [replyToId, setReplyToId] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [postBusy, setPostBusy] = useState(false);
  const [visibleRootCount, setVisibleRootCount] = useState(COMMENT_ROOT_PAGE_SIZE);

  const courseId = course?.id;
  const videoId = firstVideo?.id;

  const canModerateCourseComments = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return ["ceo", "admin", "instructor", "trainer"].includes(
        String(u?.role_name || "").toLowerCase(),
      );
    } catch {
      return false;
    }
  }, []);

  const refreshEngagement = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || !courseId || !videoId) return;
    setEngageLoading(true);
    setEngageErr("");
    try {
      const res = await fetch(`${apiBaseUrl}/api/courses/${courseId}/videos/engagement`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Could not load likes and comments.");
      }
      const likes = payload.data?.likes || {};
      const allComments = payload.data?.comments || {};
      const likeEntry = likes[String(videoId)] || { count: 0, liked: false };
      setVideoLikes({
        count: Number(likeEntry.count || 0),
        liked: Boolean(likeEntry.liked),
      });
      const roots = allComments[String(videoId)];
      setCommentRoots(Array.isArray(roots) ? roots : []);
    } catch (e) {
      setEngageErr(e.message || "Could not load discussion.");
    } finally {
      setEngageLoading(false);
    }
  }, [apiBaseUrl, courseId, videoId]);

  useEffect(() => {
    if (!open) {
      setEngageErr("");
      setCommentRoots([]);
      setVideoLikes({ count: 0, liked: false });
      setRootDraft("");
      setReplyToId(null);
      setReplyDraft("");
      setVisibleRootCount(COMMENT_ROOT_PAGE_SIZE);
      return;
    }
    if (!courseId || !videoId) return;
    setVisibleRootCount(COMMENT_ROOT_PAGE_SIZE);
    refreshEngagement();
  }, [open, courseId, videoId, refreshEngagement]);

  useEffect(() => {
    if (!open) setMoreOpen(false);
  }, [open]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onDown = (e) => {
      if (!moreWrapRef.current?.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleStart = useCallback(() => {
    onStartCourse?.();
  }, [onStartCourse]);

  const visibleComments = useMemo(
    () => filterBlockedCommentTree(commentRoots, canModerateCourseComments),
    [commentRoots, canModerateCourseComments],
  );

  const pagedRootComments = useMemo(
    () => visibleComments.slice(0, visibleRootCount),
    [visibleComments, visibleRootCount],
  );

  const hasMoreRootComments = visibleRootCount < visibleComments.length;

  useEffect(() => {
    if (!open || engageLoading) return;
    const rootEl = commentsScrollRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (!rootEl || !sentinel || !hasMoreRootComments) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setVisibleRootCount((prev) =>
          Math.min(prev + COMMENT_ROOT_PAGE_SIZE, visibleComments.length),
        );
      },
      { root: rootEl, rootMargin: "0px 0px 100px 0px", threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [open, engageLoading, hasMoreRootComments, visibleComments.length, visibleRootCount]);

  const handleCommentsScroll = useCallback(() => {
    const el = commentsScrollRef.current;
    if (!el || !hasMoreRootComments) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
    if (nearBottom) {
      setVisibleRootCount((prev) => Math.min(prev + COMMENT_ROOT_PAGE_SIZE, visibleComments.length));
    }
  }, [hasMoreRootComments, visibleComments.length]);

  const avatarInitials = useMemo(
    () => collectCommentAuthorInitials(visibleComments, 4),
    [visibleComments],
  );

  const toggleVideoLike = async () => {
    if (!courseId || !videoId) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}/likes/toggle`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to update like.");
      }
      setVideoLikes({
        liked: Boolean(payload?.data?.liked),
        count: Number(payload?.data?.like_count || 0),
      });
    } catch (e) {
      setEngageErr(e.message || "Like failed.");
    }
  };

  const postComment = async (parentCommentId) => {
    const trimmed = (parentCommentId ? replyDraft : rootDraft).trim();
    if (!courseId || !videoId || !trimmed) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setPostBusy(true);
    setEngageErr("");
    try {
      const res = await fetch(`${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          comment_text: trimmed,
          ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
        }),
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to post comment.");
      }
      if (parentCommentId) {
        setReplyDraft("");
        setReplyToId(null);
      } else {
        setRootDraft("");
        setVisibleRootCount(COMMENT_ROOT_PAGE_SIZE);
      }
      await refreshEngagement();
    } catch (e) {
      setEngageErr(e.message || "Comment failed.");
    } finally {
      setPostBusy(false);
    }
  };

  const reactToComment = async (commentId, reaction) => {
    if (!courseId || !videoId || !commentId || !["like", "dislike"].includes(reaction)) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setEngageErr("");
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}/comments/${commentId}/reaction`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reaction }),
        },
      );
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to react.");
      }
      await refreshEngagement();
    } catch (e) {
      setEngageErr(e.message || "Reaction failed.");
    }
  };

  const renderCommentNode = (c, depth = 0) => {
    const replyOpen = depth === 0 && replyToId === c.id;
    return (
      <div key={String(c.id)} className="signature-course-preview-comment">
        <div
          className="signature-course-preview-comment-row"
          style={{ marginLeft: Math.min(depth * 14, 42) }}
        >
          <div className="signature-course-preview-comment-avatar" aria-hidden>
            {commentAuthorName(c).charAt(0).toUpperCase() || "?"}
          </div>
          <div className="signature-course-preview-comment-bubble">
            <div className="signature-course-preview-comment-head">
              <span className="signature-course-preview-comment-author">{commentAuthorName(c)}</span>
              <span className="signature-course-preview-comment-date">
                {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
              </span>
            </div>
            <p className="signature-course-preview-comment-text">{c.text}</p>
            <div className="signature-course-preview-comment-actions">
              <button
                type="button"
                className={`signature-course-preview-chip ${c.myReaction === "like" ? "is-active" : ""}`}
                onClick={() => reactToComment(c.id, "like")}
              >
                👍 {Number(c.likesCount || 0)}
              </button>
              <button
                type="button"
                className={`signature-course-preview-chip ${c.myReaction === "dislike" ? "is-active" : ""}`}
                onClick={() => reactToComment(c.id, "dislike")}
              >
                👎 {Number(c.dislikesCount || 0)}
              </button>
              {depth === 0 ? (
                <button
                  type="button"
                  className="signature-course-preview-reply-link"
                  onClick={() => {
                    setReplyToId(replyOpen ? null : c.id);
                    if (replyOpen) setReplyDraft("");
                  }}
                >
                  {replyOpen ? "Cancel" : "Reply"}
                </button>
              ) : null}
            </div>
            {replyOpen ? (
              <div className="signature-course-preview-reply-box">
                <input
                  type="text"
                  className="signature-course-preview-reply-input"
                  placeholder="Write a reply…"
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") postComment(c.id);
                  }}
                />
                <button
                  type="button"
                  className="signature-course-preview-reply-send"
                  disabled={postBusy || !replyDraft.trim()}
                  onClick={() => postComment(c.id)}
                >
                  Reply
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {(c.replies || []).map((r) => renderCommentNode(r, depth + 1))}
      </div>
    );
  };

  if (!open || !course) return null;

  const title = String(course.title || "Course").trim() || "Course";
  const description =
    String(course.description || "").trim() ||
    "The original course breaks down the exact systems, scripts, and mindset to help you grow. Whether you're new or need a reset, this is where it begins.";
  const thumb = resolvePublicMediaUrl(
    heroImageUrl ||
      firstVideo?.thumbnail_url ||
      firstVideo?.thumbnail_data_url ||
      course.thumbnail_url ||
      "",
    apiBaseUrl,
  );
  const playUrl = resolveSignaturePreviewPlayUrl(firstVideo, apiBaseUrl);
  const subtitle =
    String(course.subtitle || course.tagline || "").trim() ||
    (/serhant/i.test(title) ? DEFAULT_SUBTITLE : "Signature learning experience");

  const hasVideoEngagement = Boolean(videoId);

  return (
    <div className="signature-course-preview-layer" role="presentation">
      <button
        type="button"
        className="signature-course-preview-backdrop"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div
        className="signature-course-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-course-preview-title"
      >
        <header className="signature-course-preview-header">
          <h2 id="signature-course-preview-title" className="signature-course-preview-title">
            {title}
          </h2>
          <div className="signature-course-preview-header-actions">
            <button
              type="button"
              className="signature-course-preview-icon-btn"
              aria-label={isBookmarked ? "Remove bookmark" : "Bookmark course"}
              onClick={() => onToggleBookmark?.(course.id)}
            >
              <FiBookmark className={isBookmarked ? "is-filled" : ""} />
            </button>
            <div className="signature-course-preview-more-wrap" ref={moreWrapRef}>
              <button
                type="button"
                className="signature-course-preview-icon-btn"
                aria-label="More options"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
              >
                <FiMoreHorizontal />
              </button>
              {moreOpen ? (
                <div className="signature-course-preview-more-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="signature-course-preview-more-item"
                    onClick={() => setMoreOpen(false)}
                  >
                    Share link
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="signature-course-preview-icon-btn"
              aria-label="Open course in full view"
              onClick={handleStart}
            >
              <FiMaximize2 />
            </button>
            <button type="button" className="signature-course-preview-icon-btn" aria-label="Close" onClick={onClose}>
              <FiX />
            </button>
          </div>
        </header>

        <div className="signature-course-preview-body">
          <div
            className={`signature-course-preview-hero${playUrl ? " signature-course-preview-hero--video" : ""}`}
            style={
              playUrl
                ? { background: "#0a0a0a" }
                : thumb
                  ? { backgroundImage: `url(${thumb})` }
                  : { background: "linear-gradient(145deg, #0f172a, #1e293b)" }
            }
          >
            {playUrl ? (
              <CourseAdaptiveVideo
                key={`${course.id}-${playUrl}`}
                src={playUrl}
                className="signature-course-preview-hero-video"
                controls
                playsInline
                autoPlay
                preload="metadata"
                poster={thumb || undefined}
                aria-label={firstVideo?.title ? `Preview: ${firstVideo.title}` : `Preview: ${title}`}
              />
            ) : !thumb ? (
              <span className="signature-course-preview-hero-fallback">{title}</span>
            ) : null}
          </div>
          <h3 className="signature-course-preview-subtitle">{subtitle}</h3>
          <p className="signature-course-preview-desc">{description}</p>
          <div className="signature-course-preview-cta-wrap">
            <button type="button" className="signature-course-preview-cta" onClick={handleStart}>
              Start the Course
            </button>
          </div>

          {hasVideoEngagement ? (
            <section className="signature-course-preview-discussion" aria-label="First lesson discussion">
              <div className="signature-course-preview-discussion-head">
                <h4 className="signature-course-preview-discussion-title">Comments</h4>
                {visibleComments.length > 0 ? (
                  <span className="signature-course-preview-discussion-count">
                    {pagedRootComments.length < visibleComments.length
                      ? `Showing ${pagedRootComments.length} of ${visibleComments.length}`
                      : `${visibleComments.length} total`}
                  </span>
                ) : null}
              </div>
              {engageErr ? <p className="signature-course-preview-engage-err">{engageErr}</p> : null}
              <div
                ref={commentsScrollRef}
                className="signature-course-preview-comments-scroll"
                onScroll={handleCommentsScroll}
              >
                {engageLoading && visibleComments.length === 0 ? (
                  <CommentListSkeleton count={3} />
                ) : null}
                {!engageLoading && visibleComments.length === 0 ? (
                  <p className="signature-course-preview-muted">No comments yet. Start the conversation.</p>
                ) : null}
                {pagedRootComments.map((c) => renderCommentNode(c, 0))}
                {hasMoreRootComments ? (
                  <>
                    <div
                      ref={loadMoreSentinelRef}
                      className="signature-course-preview-comments-sentinel"
                      aria-hidden
                    />
                    <p className="signature-course-preview-comments-load-hint">Scroll for more comments…</p>
                  </>
                ) : null}
              </div>
              <div className="signature-course-preview-compose">
                <textarea
                  className="signature-course-preview-compose-input"
                  rows={2}
                  placeholder="Add a comment…"
                  value={rootDraft}
                  onChange={(e) => setRootDraft(e.target.value)}
                />
                <button
                  type="button"
                  className="signature-course-preview-compose-send"
                  disabled={postBusy || !rootDraft.trim()}
                  onClick={() => postComment(null)}
                >
                  Post
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <footer className="signature-course-preview-footer">
          <button
            type="button"
            className="signature-course-preview-like"
            aria-label={videoLikes.liked ? "Unlike video" : "Like video"}
            disabled={!hasVideoEngagement || engageLoading}
            onClick={toggleVideoLike}
          >
            <FiHeart className={videoLikes.liked ? "is-filled" : ""} />
          </button>
          <div className="signature-course-preview-social">
            {avatarInitials.length > 0 ? (
              <span className="signature-course-preview-avatars" aria-hidden>
                {avatarInitials.map((ch, i) => (
                  <span key={`sig-av-${i}`} className="signature-course-preview-avatar-letter">
                    {ch}
                  </span>
                ))}
              </span>
            ) : null}
            <span className="signature-course-preview-likes">
              {hasVideoEngagement ? `${videoLikes.count} like${videoLikes.count === 1 ? "" : "s"}` : "—"}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
