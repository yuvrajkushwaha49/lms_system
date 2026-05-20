import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { FiHeart, FiMessageCircle } from "react-icons/fi";
import { FaHeart } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";
import wallofwins from "../../assets/Wall of Wins.png";

const PAGE_SIZE = 18;

export default function StudentWallOfWinsPage() {
  const [entries, setEntries] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [activeCommentEntry, setActiveCommentEntry] = useState(null);
  const [entryComments, setEntryComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isDetailMenuOpen, setIsDetailMenuOpen] = useState(false);
  const [activeCommentMenuId, setActiveCommentMenuId] = useState(null);
  const [error, setError] = useState("");
  const offsetRef = useRef(0);
  const fetchLockRef = useRef(false);
  const hasMoreRef = useRef(true);
  const commentInputRef = useRef(null);

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const fetchPage = useCallback(
    async (reset = false) => {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Session missing. Please login first.");
        return;
      }
      if (fetchLockRef.current) return;
      const offset = reset ? 0 : offsetRef.current;
      if (!reset && !hasMoreRef.current) return;

      fetchLockRef.current = true;
      try {
        if (reset) {
          setIsLoading(true);
          offsetRef.current = 0;
        } else {
          setIsLoadingMore(true);
        }
        setError("");
        const response = await fetch(
          `${apiBaseUrl}/api/wall-of-wins?limit=${PAGE_SIZE}&offset=${offset}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = await response.json();
        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Unable to load Wall of Wins.");
        }
        const rows = Array.isArray(payload.data) ? payload.data : [];
        const pagination = payload.pagination || {};
        const nextOff =
          pagination.next_offset != null
            ? Number(pagination.next_offset)
            : offset + rows.length;
        offsetRef.current = nextOff;
        setEntries((prev) => (reset ? rows : [...prev, ...rows]));
        const more = Boolean(pagination.has_more);
        hasMoreRef.current = more;
        setHasMore(more);
      } catch (fetchError) {
        setError(fetchError.message || "Unable to load Wall of Wins.");
      } finally {
        fetchLockRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [apiBaseUrl],
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      offsetRef.current = 0;
      hasMoreRef.current = true;
      setHasMore(true);
      fetchPage(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [apiBaseUrl, fetchPage]);

  const toggleLike = async (entryId) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/wall-of-wins/${entryId}/likes/toggle`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to update like.");
      }
      setEntries((prev) =>
        prev.map((entry) =>
          String(entry.id) === String(entryId)
            ? {
                ...entry,
                is_liked: Boolean(payload?.data?.is_liked),
                likes_count: Number(payload?.data?.likes_count || 0),
              }
            : entry,
        ),
      );
      setActiveCommentEntry((entry) =>
        entry && String(entry.id) === String(entryId)
          ? {
              ...entry,
              is_liked: Boolean(payload?.data?.is_liked),
              likes_count: Number(payload?.data?.likes_count || 0),
            }
          : entry,
      );
    } catch (e) {
      setError(e.message || "Unable to update like.");
    }
  };

  const openComments = async (entry) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      setIsCommentModalOpen(true);
      setActiveCommentEntry(entry);
      setIsDetailMenuOpen(false);
      setActiveCommentMenuId(null);
      setCommentDraft("");
      setIsCommentsLoading(true);
      const response = await fetch(
        `${apiBaseUrl}/api/wall-of-wins/${entry.id}/comments`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to load comments.");
      }
      setEntryComments(Array.isArray(payload.data) ? payload.data : []);
    } catch (e) {
      setError(e.message || "Unable to load comments.");
      setEntryComments([]);
    } finally {
      setIsCommentsLoading(false);
    }
  };

  const closeComments = () => {
    setIsCommentModalOpen(false);
    setActiveCommentEntry(null);
    setIsDetailMenuOpen(false);
    setActiveCommentMenuId(null);
    setEntryComments([]);
    setCommentDraft("");
  };

  const activeEntryIndex = useMemo(
    () =>
      entries.findIndex(
        (entry) => String(entry.id) === String(activeCommentEntry?.id),
      ),
    [entries, activeCommentEntry],
  );

  const canShowPrevious = activeEntryIndex > 0;
  const canShowNext =
    activeEntryIndex >= 0 && activeEntryIndex < entries.length - 1;

  const showAdjacentEntry = (direction) => {
    if (activeEntryIndex < 0) return;
    const nextIndex = activeEntryIndex + direction;
    if (nextIndex < 0 || nextIndex >= entries.length) return;
    const targetEntry = entries[nextIndex];
    if (!targetEntry) return;
    openComments(targetEntry);
  };

  const focusReplyInput = () => {
    setIsDetailMenuOpen(false);
    window.setTimeout(() => {
      commentInputRef.current?.focus();
    }, 0);
  };

  const focusReplyInputForComment = (comment) => {
    setActiveCommentMenuId(null);
    const prefix = comment?.user_name ? `@${comment.user_name} ` : "";
    setCommentDraft(prefix);
    window.setTimeout(() => {
      commentInputRef.current?.focus();
    }, 0);
  };

  const handleCommentReport = () => {
    setActiveCommentMenuId(null);
    setError("Comment report feature is coming soon.");
  };

  const handleCommentEdit = () => {
    setActiveCommentMenuId(null);
    setError("Comment edit feature is coming soon.");
  };

  const handleCommentDelete = () => {
    setActiveCommentMenuId(null);
    setError("Comment delete feature is coming soon.");
  };

  const handleReportEntry = () => {
    setIsDetailMenuOpen(false);
    setError("Report feature is coming soon.");
  };

  const handleDeleteEntry = async () => {
    const token = localStorage.getItem("token");
    if (!token || !activeCommentEntry?.id) return;
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/wall-of-wins/${activeCommentEntry.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to delete post.");
      }
      setEntries((prev) =>
        prev.filter(
          (entry) => String(entry.id) !== String(activeCommentEntry.id),
        ),
      );
      closeComments();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete post.");
    } finally {
      setIsDetailMenuOpen(false);
    }
  };

  const postComment = async () => {
    const token = localStorage.getItem("token");
    if (!token || !activeCommentEntry?.id) return;
    const text = String(commentDraft || "").trim();
    if (!text) return;
    try {
      setIsPostingComment(true);
      const response = await fetch(
        `${apiBaseUrl}/api/wall-of-wins/${activeCommentEntry.id}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ comment_text: text }),
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to add comment.");
      }
      const newComment = payload?.data?.comment;
      if (newComment) setEntryComments((prev) => [...prev, newComment]);
      setCommentDraft("");
      setActiveCommentEntry((entry) =>
        entry
          ? {
              ...entry,
              comments_count: Number(
                payload?.data?.comments_count || entry.comments_count || 0,
              ),
            }
          : entry,
      );
      setEntries((prev) =>
        prev.map((entry) =>
          String(entry.id) === String(activeCommentEntry.id)
            ? {
                ...entry,
                comments_count: Number(
                  payload?.data?.comments_count || entry.comments_count || 0,
                ),
              }
            : entry,
        ),
      );
    } catch (e) {
      setError(e.message || "Unable to add comment.");
    } finally {
      setIsPostingComment(false);
    }
  };

  return (
    <StudentDashboardSectionPage title="Wall of Wins">
      <div className="wall-of-wins-shell">
        <div className="wall-of-wins-topbar">
          <h1>🏆 Wall of Wins</h1>
          <div className="wall-of-wins-topbar-actions">
            <button
              type="button"
              className="btn d-flex align-items-center gap-1"
            >
              Latest <i className="bi bi-chevron-down"></i>
            </button>
          </div>
        </div>

      <div className="student-community-filters">
                <img src={wallofwins} alt="Filters" />
              </div>

        {error && (
          <div className="alert alert-danger py-2" role="alert">
            {error}
          </div>
        )}

        {isLoading && entries.length === 0 ? (
          <div className="lms-card p-5 text-center text-muted">
            Loading celebrations…
          </div>
        ) : entries.length === 0 ? (
          <div className="lms-card p-5 text-center text-muted">
            <p className="mb-0">No photos yet. Check back soon.</p>
          </div>
        ) : (
          <div className="wall-of-wins-grid">
            {entries.map((entry) => (
              <article key={entry.id} className="wall-of-wins-card-v2">
                <button
                  type="button"
                  className="wall-of-wins-card-media"
                  aria-label={`Open ${entry.title || "Wall of Wins post"}`}
                  onClick={() => openComments(entry)}
                >
                  <img
                    src={entry.image_url}
                    alt={
                      entry.image_name
                        ? `Win photo from ${entry.user_name || "member"}`
                        : "Win photo"
                    }
                    className="wall-of-wins-thumb"
                    loading="lazy"
                  />
                </button>
                <div className="wall-of-wins-card-foot">
                  <div className="wall-of-wins-card-meta">
                    <span>{entry.title || "Untitled win"}</span>
                    <small>
                      {entry.created_at
                        ? new Date(entry.created_at).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )
                        : "Recent"}
                    </small>
                  </div>
                  <div className="text-muted small mb-1">
                    {entry.user_name || "Member"}
                  </div>
                  <div className="wall-of-wins-card-stats">
                    <button
                      type="button"
                      className={`btn btn-link p-0 text-decoration-none ${entry.is_liked ? "text-danger" : "text-muted"}`}
                      onClick={() => toggleLike(entry.id)}
                    >
                      {entry.is_liked ? (
                        <FaHeart size={14} color="red" />
                      ) : (
                        <FiHeart size={14} />
                      )}
                      {Number(entry.likes_count || 0)}
                    </button>
                    <button
                      type="button"
                      className="btn btn-link p-0 text-decoration-none text-muted"
                      onClick={() => openComments(entry)}
                    >
                      <FiMessageCircle size={14} />{" "}
                      {Number(entry.comments_count || 0)}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {hasMore && entries.length > 0 && (
          <div className="text-center mt-4">
            <button
              type="button"
              className="btn btn-outline-primary"
              disabled={isLoadingMore}
              onClick={() => fetchPage(false)}
            >
              {isLoadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
        {isCommentModalOpen ? (
          <div
            className="sell-snack-modal wall-of-wins-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Post details"
          >
            <button
              type="button"
              className="sell-snack-modal-backdrop"
              aria-label="Close post details"
              onClick={closeComments}
            />
            <button
              type="button"
              className="wall-of-wins-nav wall-of-wins-nav-prev"
              aria-label="Previous post"
              disabled={!canShowPrevious}
              onClick={() => showAdjacentEntry(-1)}
            >
              <FiChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="wall-of-wins-nav wall-of-wins-nav-next"
              aria-label="Next post"
              disabled={!canShowNext}
              onClick={() => showAdjacentEntry(1)}
            >
              <FiChevronRight size={20} />
            </button>
            <div className="sell-snack-modal-card wall-of-wins-detail-card">
              <div className="wall-of-wins-detail-image">
                {activeCommentEntry?.image_url ? (
                  <img
                    src={activeCommentEntry.image_url}
                    alt={
                      activeCommentEntry.image_name
                        ? `Win photo from ${activeCommentEntry.user_name || "member"}`
                        : "Win photo"
                    }
                  />
                ) : null}
              </div>
              <div className="wall-of-wins-detail-panel">
                <div className="wall-of-wins-detail-head">
                  <h2>Post details</h2>
                  <button
                    type="button"
                    aria-label="Close post details"
                    onClick={closeComments}
                  >
                    <FiX size={20} />
                  </button>
                </div>
                <div className="wall-of-wins-detail-content">
                  <div className="wall-of-wins-detail-menu-wrap">
                    <button
                      type="button"
                      className="wall-of-wins-detail-more"
                      aria-label="More options"
                      onClick={() => setIsDetailMenuOpen((prev) => !prev)}
                    >
                      ...
                    </button>
                    {isDetailMenuOpen ? (
                      <div className="wall-of-wins-detail-menu">
                        <button type="button" onClick={focusReplyInput}>
                          Reply
                        </button>
                        <button type="button" onClick={handleReportEntry}>
                          Report
                        </button>
                        <button type="button" onClick={focusReplyInput}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-danger"
                          onClick={handleDeleteEntry}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <p className="wall-of-wins-detail-copy">
                    {activeCommentEntry?.title ||
                      "Congratulations on this win!"}
                  </p>
                  <div className="wall-of-wins-detail-author">
                    {activeCommentEntry?.user_name || "Member"}
                    {activeCommentEntry?.created_at ? (
                      <span>
                        {new Date(
                          activeCommentEntry.created_at,
                        ).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    ) : null}
                  </div>
                  <div className="wall-of-wins-detail-actions">
                    <button
                      type="button"
                      className={activeCommentEntry?.is_liked ? "is-liked" : ""}
                      onClick={() => toggleLike(activeCommentEntry.id)}
                    >
                      {activeCommentEntry?.is_liked ? (
                        <FaHeart size={17} color="red" />
                      ) : (
                        <FiHeart size={17} />
                      )}
                    </button>
                    <button type="button">
                      <FiMessageCircle size={17} />
                    </button>
                    <span>
                      {Number(activeCommentEntry?.likes_count || 0)} likes ·{" "}
                      {Number(activeCommentEntry?.comments_count || 0)} comments
                    </span>
                  </div>
                  <div className="wall-of-wins-detail-comments">
                    {isCommentsLoading ? (
                      <p className="text-muted small mb-0">
                        Loading comments...
                      </p>
                    ) : entryComments.length === 0 ? (
                      <p className="text-muted small mb-0">No comments yet.</p>
                    ) : (
                      entryComments.map((comment) => (
                        <div key={comment.id} className="wall-of-wins-comment">
                          <div className="wall-of-wins-comment-head">
                            <p className="mb-0 fw-semibold small">
                              {comment.user_name || "Member"}
                            </p>
                            <div className="wall-of-wins-comment-menu-wrap">
                              <button
                                type="button"
                                className="wall-of-wins-comment-menu-trigger"
                                aria-label="Comment actions"
                                onClick={() =>
                                  setActiveCommentMenuId((prev) =>
                                    String(prev) === String(comment.id)
                                      ? null
                                      : String(comment.id),
                                  )
                                }
                              >
                                ...
                              </button>
                              {String(activeCommentMenuId) ===
                              String(comment.id) ? (
                                <div className="wall-of-wins-comment-menu">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      focusReplyInputForComment(comment)
                                    }
                                  >
                                    Reply
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCommentReport}
                                  >
                                    Report
                                  </button>
                                  <button type="button" onClick={handleCommentEdit}>
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="text-danger"
                                    onClick={handleCommentDelete}
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <p className="mb-1">{comment.comment_text}</p>
                          <p className="mb-0 text-muted small">
                            {comment.created_at
                              ? new Date(comment.created_at).toLocaleString()
                              : ""}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="wall-of-wins-detail-compose">
                  <input
                    ref={commentInputRef}
                    type="text"
                    className="form-control"
                    placeholder="What are your thoughts?"
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") postComment();
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isPostingComment || !commentDraft.trim()}
                    onClick={postComment}
                  >
                    {isPostingComment ? "Posting..." : "Post"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </StudentDashboardSectionPage>
  );
}

