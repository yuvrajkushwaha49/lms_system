import { useCallback, useEffect, Fragment, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CommunityVideoPlayer from "../../components/CommunityVideoPlayer";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";
import CommentReportReasonModal from "../../components/CommentReportReasonModal";
import { REPORT_REASONS } from "../../constants/reportReasons";

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "-";
  }
};

const resolveCommentAuthorName = (comment) =>
  comment?.user_name || comment?.userName || comment?.name || "Unknown User";

function appendReplyToComment(comments, parentId, reply) {
  return comments.map((c) => {
    if (String(c.id) === String(parentId)) {
      return { ...c, replies: [...(c.replies || []), reply] };
    }
    if (Array.isArray(c.replies) && c.replies.length) {
      return { ...c, replies: appendReplyToComment(c.replies, parentId, reply) };
    }
    return c;
  });
}

function updateCommentReactionInTree(comments, commentId, patch) {
  return comments.map((c) => {
    if (String(c.id) === String(commentId)) {
      return { ...c, ...patch };
    }
    if (Array.isArray(c.replies) && c.replies.length) {
      return { ...c, replies: updateCommentReactionInTree(c.replies, commentId, patch) };
    }
    return c;
  });
}

function updateCommentTextInTree(comments, commentId, text) {
  return comments.map((c) => {
    if (String(c.id) === String(commentId)) {
      return { ...c, text };
    }
    if (Array.isArray(c.replies) && c.replies.length) {
      return { ...c, replies: updateCommentTextInTree(c.replies, commentId, text) };
    }
    return c;
  });
}

function removeCommentSubtreeFromTree(comments, commentId) {
  const idStr = String(commentId);
  return comments
    .filter((c) => String(c.id) !== idStr)
    .map((c) => ({
      ...c,
      replies: removeCommentSubtreeFromTree(c.replies || [], commentId),
    }));
}

function normalizeSnackCommentFromApi(data) {
  if (!data) return null;
  let storedName = "Unknown User";
  try {
    storedName = JSON.parse(localStorage.getItem("user") || "{}")?.name || "Unknown User";
  } catch {
    /* ignore */
  }
  return {
    id: data.id,
    user_id: data.user_id != null ? Number(data.user_id) : null,
    parent_comment_id: data.parent_comment_id != null ? Number(data.parent_comment_id) : null,
    text: data.comment_text || data.text || "",
    user_name: data.user_name || storedName,
    createdAt: data.created_at || data.createdAt || new Date().toISOString(),
    likesCount: Number(data.likesCount ?? data.likes_count ?? 0),
    dislikesCount: Number(data.dislikesCount ?? data.dislikes_count ?? 0),
    myReaction: data.myReaction ?? data.my_reaction ?? null,
    replies: Array.isArray(data.replies) ? data.replies : [],
  };
}

export default function SellItSnackDetailPage({
  SectionComponent = StudentDashboardSectionPage,
  backPath = "/dashboard/student-sell-it-snacks",
  detailBasePath = "/dashboard/student-sell-it-snacks",
  /** Course-style gradient overview + metric tiles (trainer/admin). Hidden on student panel. */
  showHeroOverview = false,
}) {
  const DashboardSection = SectionComponent;
  const { snackId } = useParams();
  const [snack, setSnack] = useState(null);
  const [engagement, setEngagement] = useState({
    liked: false,
    like_count: 0,
  });
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsHasMore, setCommentsHasMore] = useState(true);
  const commentsPagingRef = useRef({ limit: 12, offset: 0 });
  const commentsFetchLockRef = useRef(false);
  const commentsRequestIdRef = useRef(0);

  const [suggestedSnacks, setSuggestedSnacks] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsHasMore, setSuggestionsHasMore] = useState(true);
  const suggestionsPagingRef = useRef({ limit: 8, offset: 0 });
  const suggestionsFetchLockRef = useRef(false);
  const suggestionsRequestIdRef = useRef(0);

  const [commentDraft, setCommentDraft] = useState("");
  const [replyParentId, setReplyParentId] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [commentEditDraft, setCommentEditDraft] = useState("");
  const [isSavingCommentEdit, setIsSavingCommentEdit] = useState(false);
  const [snackCommentMenuOpenId, setSnackCommentMenuOpenId] = useState(null);
  const [snackReportComment, setSnackReportComment] = useState(null);
  const [snackReportReason, setSnackReportReason] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const commentsScrollRef = useRef(null);
  const suggestionsScrollRef = useRef(null);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || "http://localhost:5003").replace(/\/$/, ""),
    [],
  );

  const sessionUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const currentUserId = Number(sessionUser?.id) || null;
  const canModerateSnackCommentsUi = ["ceo", "admin", "instructor", "trainer"].includes(
    String(sessionUser?.role_name || "").toLowerCase(),
  );
  const canModifySnackCommentItem = (comment) =>
    canModerateSnackCommentsUi ||
    (currentUserId != null && Number(comment.user_id) === currentUserId);

  useEffect(() => {
    commentsRequestIdRef.current += 1;
    suggestionsRequestIdRef.current += 1;
    setComments([]);
    setSuggestedSnacks([]);
    commentsPagingRef.current.offset = 0;
    suggestionsPagingRef.current.offset = 0;
    setCommentsHasMore(true);
    setSuggestionsHasMore(true);
    setReplyParentId(null);
    setReplyDraft("");
    setEditingCommentId(null);
    setCommentEditDraft("");
    setSnackCommentMenuOpenId(null);
    setSnackReportComment(null);
    setSnackReportReason("");
    setNotice("");
  }, [snackId]);

  useEffect(() => {
    if (snackCommentMenuOpenId === null) return undefined;
    const close = () => setSnackCommentMenuOpenId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [snackCommentMenuOpenId]);

  const fetchSnack = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      return;
    }
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/snacks/${snackId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to fetch Sell It Snack.");
      }
      const raw = payload.data || {};
      const { engagement: engagementPayload, ...snackPayload } = raw;
      setSnack(snackPayload);
      setEngagement({
        liked: Boolean(engagementPayload?.liked),
        like_count: Number(engagementPayload?.like_count ?? snackPayload?.likes_count ?? 0),
      });
    } catch (fetchError) {
      setSnack(null);
      setEngagement({ liked: false, like_count: 0 });
      setError(fetchError.message || "Unable to fetch Sell It Snack.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, snackId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchSnack, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchSnack]);

  const fetchCommentsPage = useCallback(
    async (reset = false) => {
      const token = localStorage.getItem("token");
      if (!token || !snackId) return;
      const requestId = commentsRequestIdRef.current;
      const { limit } = commentsPagingRef.current;
      const offset = reset ? 0 : commentsPagingRef.current.offset;
      if (!reset && (!commentsHasMore || commentsFetchLockRef.current)) return;
      if (reset) commentsPagingRef.current.offset = 0;

      commentsFetchLockRef.current = true;
      try {
        setCommentsLoading(true);
        const response = await fetch(
          `${apiBaseUrl}/api/snacks/${snackId}/comments?limit=${limit}&offset=${offset}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = await response.json();
        if (requestId !== commentsRequestIdRef.current) return;
        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Unable to load comments.");
        }
        const pack = payload.data || {};
        const page = Array.isArray(pack.comments) ? pack.comments : [];
        setComments((prev) => (reset ? page : [...prev, ...page]));
        commentsPagingRef.current.offset = offset + page.length;
        setCommentsHasMore(Boolean(pack.has_more));
      } catch {
        if (requestId !== commentsRequestIdRef.current) return;
        if (reset) setComments([]);
        setCommentsHasMore(false);
      } finally {
        if (requestId === commentsRequestIdRef.current) {
          setCommentsLoading(false);
          commentsFetchLockRef.current = false;
        }
      }
    },
    [apiBaseUrl, snackId, commentsHasMore],
  );

  const fetchSuggestionsPage = useCallback(
    async (reset = false) => {
      const token = localStorage.getItem("token");
      if (!token || !snackId) return;
      const requestId = suggestionsRequestIdRef.current;
      const { limit } = suggestionsPagingRef.current;
      const offset = reset ? 0 : suggestionsPagingRef.current.offset;
      if (!reset && (!suggestionsHasMore || suggestionsFetchLockRef.current)) return;
      if (reset) suggestionsPagingRef.current.offset = 0;

      suggestionsFetchLockRef.current = true;
      try {
        setSuggestionsLoading(true);
        const response = await fetch(
          `${apiBaseUrl}/api/snacks/${snackId}/suggestions?limit=${limit}&offset=${offset}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = await response.json();
        if (requestId !== suggestionsRequestIdRef.current) return;
        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Unable to load suggestions.");
        }
        const page = Array.isArray(payload.data) ? payload.data : [];
        setSuggestedSnacks((prev) => (reset ? page : [...prev, ...page]));
        suggestionsPagingRef.current.offset = offset + page.length;
        setSuggestionsHasMore(Boolean(payload.has_more));
      } catch {
        if (requestId !== suggestionsRequestIdRef.current) return;
        if (reset) setSuggestedSnacks([]);
        setSuggestionsHasMore(false);
      } finally {
        if (requestId === suggestionsRequestIdRef.current) {
          setSuggestionsLoading(false);
          suggestionsFetchLockRef.current = false;
        }
      }
    },
    [apiBaseUrl, snackId, suggestionsHasMore],
  );

  useEffect(() => {
    if (!snack?.id || String(snack.id) !== String(snackId)) return undefined;
    const t = window.setTimeout(() => {
      fetchCommentsPage(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [snack?.id, snackId, fetchCommentsPage]);

  useEffect(() => {
    if (!snack?.id || String(snack.id) !== String(snackId)) return undefined;
    const t = window.setTimeout(() => {
      fetchSuggestionsPage(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [snack?.id, snackId, fetchSuggestionsPage]);

  const handleCommentsScroll = () => {
    const el = commentsScrollRef.current;
    if (!el || commentsLoading || !commentsHasMore) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (nearBottom) fetchCommentsPage(false);
  };

  const handleSuggestionsScroll = () => {
    const el = suggestionsScrollRef.current;
    if (!el || suggestionsLoading || !suggestionsHasMore) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    if (nearBottom) fetchSuggestionsPage(false);
  };

  const readyVariants = useMemo(
    () => (snack?.video_variants || []).filter((variant) => variant.status === "ready" && variant.media_url),
    [snack],
  );

  const hasProcessingVariants = useMemo(
    () =>
      (snack?.video_variants || []).some(
        (variant) => variant.status === "pending" || variant.status === "processing",
      ),
    [snack?.video_variants],
  );

  const primaryVideoSrc = snack?.video_url || readyVariants[0]?.media_url || "";

  const statusClass =
    snack?.processing_status === "failed"
      ? "text-bg-danger"
      : snack?.processing_status === "processing"
        ? "text-bg-warning"
        : "text-bg-success";

  const toggleSnackLike = async () => {
    if (!snackId) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/snacks/${snackId}/likes/toggle`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to update like.");
      }
      const nextCount = Number(payload?.data?.like_count || 0);
      const nextLiked = Boolean(payload?.data?.liked);
      setSnack((prev) => (prev ? { ...prev, likes_count: nextCount } : prev));
      setEngagement((prev) => ({
        ...prev,
        liked: nextLiked,
        like_count: nextCount,
      }));
    } catch (likeError) {
      setError(likeError.message);
    }
  };

  const addComment = async () => {
    const trimmed = commentDraft.trim();
    if (!snackId || !trimmed) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/snacks/${snackId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ comment_text: trimmed }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to add comment.");
      }
      const insertedComment = normalizeSnackCommentFromApi(payload?.data);
      if (insertedComment) insertedComment.replies = [];
      if (insertedComment) setComments((prev) => [insertedComment, ...prev]);
      setSnack((prev) =>
        prev ? { ...prev, comments_count: Number(prev.comments_count || 0) + 1 } : prev,
      );
      setCommentDraft("");
    } catch (commentError) {
      setError(commentError.message);
    }
  };

  const submitReply = async (parentId) => {
    const trimmed = replyDraft.trim();
    if (!snackId || !trimmed || !parentId) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/snacks/${snackId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ comment_text: trimmed, parent_comment_id: parentId }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to add reply.");
      }
      const insertedReply = normalizeSnackCommentFromApi(payload?.data);
      if (insertedReply) insertedReply.replies = [];
      if (insertedReply) setComments((prev) => appendReplyToComment(prev, parentId, insertedReply));
      setSnack((prev) =>
        prev ? { ...prev, comments_count: Number(prev.comments_count || 0) + 1 } : prev,
      );
      setReplyDraft("");
      setReplyParentId(null);
    } catch (replyError) {
      setError(replyError.message);
    }
  };

  const reactToComment = async (commentId, reaction) => {
    if (!snackId || !commentId || !["like", "dislike"].includes(reaction)) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/snacks/${snackId}/comments/${commentId}/reaction`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reaction }),
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to react on comment.");
      }
      const nextLikes = Number(payload?.data?.likes_count || 0);
      const nextDislikes = Number(payload?.data?.dislikes_count || 0);
      const nextMyReaction = payload?.data?.my_reaction || null;
      setComments((prev) =>
        updateCommentReactionInTree(prev, commentId, {
          likesCount: nextLikes,
          dislikesCount: nextDislikes,
          myReaction: nextMyReaction,
        }),
      );
    } catch (reactionError) {
      setError(reactionError.message);
    }
  };

  const saveSnackCommentEdit = async (commentId) => {
    const trimmed = commentEditDraft.trim();
    if (!snackId || !trimmed || !commentId) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      setIsSavingCommentEdit(true);
      const response = await fetch(`${apiBaseUrl}/api/snacks/${snackId}/comments/${commentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ comment_text: trimmed }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to save comment.");
      }
      const text =
        typeof payload?.data?.comment_text === "string" ? payload.data.comment_text : trimmed;
      setComments((prev) => updateCommentTextInTree(prev, commentId, text));
      setEditingCommentId(null);
      setCommentEditDraft("");
    } catch (editErr) {
      setError(editErr.message);
    } finally {
      setIsSavingCommentEdit(false);
    }
  };

  const deleteSnackCommentRequest = async (commentId) => {
    if (!snackId || !commentId) return;
    if (!window.confirm("Delete this comment and all replies under it?")) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/snacks/${snackId}/comments/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to delete comment.");
      }
      const deletedCount = Number(payload?.data?.deleted_count ?? 1);
      setComments((prev) => removeCommentSubtreeFromTree(prev, commentId));
      setSnack((prev) =>
        prev
          ? {
              ...prev,
              comments_count: Math.max(0, Number(prev.comments_count || 0) - deletedCount),
            }
          : prev,
      );
      setEditingCommentId((cur) => (cur === commentId ? null : cur));
      setCommentEditDraft("");
      setReplyParentId((cur) => (cur === commentId ? null : cur));
      setReplyDraft("");
    } catch (delErr) {
      setError(delErr.message);
    }
  };

  const submitSnackCommentReport = async () => {
    const cid = snackReportComment?.id;
    if (!snackReportReason.trim() || !snackId || !cid) return;
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      return;
    }
    try {
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/snacks/${snackId}/comments/${cid}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: snackReportReason }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to submit report.");
      }
      setNotice("Thanks — your report was submitted for review.");
      setSnackReportComment(null);
      setSnackReportReason("");
    } catch (reportErr) {
      setError(reportErr.message || "Unable to submit report.");
    }
  };

  const displayLikeCount = Number(snack?.likes_count ?? engagement.like_count ?? 0);

  const renderCommentCard = (comment, { depth = 0 } = {}) => (
    <div
      className={`${depth > 0 ? "sell-snack-comment-reply ms-3 mt-2 ps-3 border-start border-secondary border-opacity-25" : "mb-3"} student-comment-item`}
    >
      <div className="d-flex align-items-start gap-2">
        <div
          className="rounded-circle bg-secondary text-white d-inline-flex align-items-center justify-content-center"
          style={{
            width: 30,
            height: 30,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {resolveCommentAuthorName(comment).charAt(0).toUpperCase()}
        </div>
        <div className="border rounded-3 px-3 py-2 bg-light w-100">
          <p className="mb-1 fw-semibold small">{resolveCommentAuthorName(comment)}</p>
          {editingCommentId === comment.id ? (
            <div className="mt-1 mb-2">
              <textarea
                className="form-control form-control-sm"
                rows={2}
                value={commentEditDraft}
                onChange={(event) => setCommentEditDraft(event.target.value)}
              />
              <div className="d-flex gap-2 mt-2">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={isSavingCommentEdit}
                  onClick={() => saveSnackCommentEdit(comment.id)}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={isSavingCommentEdit}
                  onClick={() => {
                    setEditingCommentId(null);
                    setCommentEditDraft("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mb-1">{comment.text}</p>
          )}
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <p className="mb-0 text-muted small">{new Date(comment.createdAt).toLocaleString()}</p>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button
                type="button"
                className={`btn btn-sm rounded-pill ${
                  comment.myReaction === "like" ? "btn-dark" : "btn-outline-secondary"
                }`}
                onClick={() => reactToComment(comment.id, "like")}
              >
                👍 {Number(comment.likesCount || 0)}
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-pill ${
                  comment.myReaction === "dislike" ? "btn-dark" : "btn-outline-secondary"
                }`}
                onClick={() => reactToComment(comment.id, "dislike")}
              >
                👎 {Number(comment.dislikesCount || 0)}
              </button>
              {editingCommentId !== comment.id && (
                <div className="comment-actions-menu-wrap ms-auto">
                  <button
                    type="button"
                    className="comment-actions-toggle"
                    aria-label="Comment actions"
                    aria-expanded={snackCommentMenuOpenId === String(comment.id)}
                    aria-haspopup="menu"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSnackCommentMenuOpenId((cur) =>
                        cur === String(comment.id) ? null : String(comment.id),
                      );
                    }}
                  >
                    ⋮
                  </button>
                  {snackCommentMenuOpenId === String(comment.id) ? (
                    <div className="comment-actions-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplyParentId((cur) => (cur === comment.id ? null : comment.id));
                          setReplyDraft("");
                          setSnackCommentMenuOpenId(null);
                        }}
                      >
                        {replyParentId === comment.id ? "Cancel reply" : "Reply"}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSnackReportComment(comment);
                          setSnackReportReason("");
                          setSnackCommentMenuOpenId(null);
                        }}
                      >
                        Report
                      </button>
                      {canModifySnackCommentItem(comment) ? (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCommentId(comment.id);
                              setCommentEditDraft(comment.text || "");
                              setReplyParentId(null);
                              setReplyDraft("");
                              setSnackCommentMenuOpenId(null);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="text-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSnackCommentMenuOpenId(null);
                              deleteSnackCommentRequest(comment.id);
                            }}
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          {replyParentId === comment.id && editingCommentId !== comment.id && (
            <div className="d-flex gap-2 mt-2 student-comment-input-row">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Write a reply..."
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitReply(comment.id);
                }}
              />
              <button type="button" className="btn btn-sm btn-primary" onClick={() => submitReply(comment.id)}>
                Send
              </button>
            </div>
          )}
        </div>
      </div>
      {(comment.replies || []).map((reply) => (
        <Fragment key={String(reply.id)}>{renderCommentCard(reply, { depth: depth + 1 })}</Fragment>
      ))}
    </div>
  );

  return (
    <DashboardSection title="Sell It Snack Detail">
      <div className="container-fluid px-0 sell-snack-detail-page" style={{ maxWidth: 1200 }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Link to={backPath} className="btn btn-outline-secondary btn-sm">
            Back to Sell It Snacks
          </Link>
        </div>

        {error && <div className="alert alert-danger mb-3">{error}</div>}
        {notice && <div className="alert alert-success mb-3">{notice}</div>}

        {!showHeroOverview && isLoading && (
          <div className="lms-card p-4 mb-3 text-muted">Loading Sell It Snack...</div>
        )}

        {showHeroOverview && (
          <div
            className="lms-card p-4 p-md-5 mb-3 text-white border-0"
            style={{
              background: "linear-gradient(120deg,#071d3d,#0d2f69 45%,#0a5dea)",
              boxShadow: "0 18px 45px rgba(7,29,61,0.35)",
            }}
          >
            {isLoading ? (
              <p className="mb-0">Loading Sell It Snack...</p>
            ) : (
              <>
                <p className="text-uppercase small mb-1 text-light">Sell It Snack Overview</p>
                <h1 className="h2 fw-bold mb-2">{snack?.title || "Sell It Snack Detail"}</h1>
                <p className="mb-3 text-light">{snack?.description || "Watch this Sell It Snack."}</p>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <span className="badge bg-light text-dark px-3 py-2">Section: {snack?.category || "-"}</span>
                  <span className={`badge px-3 py-2 ${statusClass}`}>{snack?.processing_status || "ready"}</span>
                  <span className="badge bg-light text-dark px-3 py-2">Uploaded: {formatDate(snack?.created_at)}</span>
                </div>
                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <div
                      className="rounded-3 p-3 h-100"
                      style={{ background: "rgba(255,255,255,0.13)", backdropFilter: "blur(3px)" }}
                    >
                      <p className="small text-uppercase mb-1 text-light">Likes</p>
                      <h3 className="h4 mb-0 fw-bold">{displayLikeCount}</h3>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div
                      className="rounded-3 p-3 h-100"
                      style={{ background: "rgba(255,255,255,0.13)", backdropFilter: "blur(3px)" }}
                    >
                      <p className="small text-uppercase mb-1 text-light">Comments</p>
                      <h3 className="h4 mb-0 fw-bold">{Number(snack?.comments_count || 0)}</h3>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div
                      className="rounded-3 p-3 h-100"
                      style={{ background: "rgba(255,255,255,0.13)", backdropFilter: "blur(3px)" }}
                    >
                      <p className="small text-uppercase mb-1 text-light">Video Qualities</p>
                      <h3 className="h4 mb-0 fw-bold">{readyVariants.length || 1}</h3>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="row g-3 align-items-start">
          <div className="col-xl-8">
            <div className="lms-card p-0 overflow-hidden border-0" style={{ boxShadow: "0 10px 28px rgba(15,23,42,0.08)" }}>
              <div
                className="d-flex justify-content-between align-items-center p-3 border-bottom gap-3 flex-wrap"
                style={{ background: "linear-gradient(180deg,#f8fbff,#ffffff)" }}
              >
                <div className="min-w-0">
                  {showHeroOverview ? (
                    <h2 className="h5 mb-0">Watch Video</h2>
                  ) : (
                    <>
                      {snack?.title && (
                        <h2 className="h5 fw-bold mb-0 text-truncate" title={snack.title}>
                          {snack.title}
                        </h2>
                      )}
                      <p className={`mb-0 text-muted small ${snack?.title ? "mt-1" : ""}`}>Watch Video</p>
                    </>
                  )}
                </div>
              </div>
              <div className="position-relative bg-dark">
                {primaryVideoSrc ? (
                  <>
                    <CommunityVideoPlayer
                      src={primaryVideoSrc}
                      title={snack?.title || "Sell It Snack"}
                      variants={snack?.video_variants || []}
                      autoQualityLabel="Original"
                    />
                    {hasProcessingVariants && (
                      <span className="student-community-video-processing">Processing HD</span>
                    )}
                  </>
                ) : (
                  <div className="text-center py-5 text-muted">Video is not available.</div>
                )}
              </div>
              <div className="px-4 py-3 border-top student-interaction-panel">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="rounded-circle bg-dark text-white d-inline-flex align-items-center justify-content-center fw-semibold"
                      style={{ width: 38, height: 38 }}
                    >
                      {(snack?.category || "S").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="mb-0 fw-semibold">{snack?.category || "Sell It Snacks"}</p>
                      <p className="mb-0 text-muted small">Snack library</p>
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill ${engagement.liked ? "btn-dark" : "btn-outline-secondary"}`}
                      onClick={() => toggleSnackLike()}
                    >
                      👍 {displayLikeCount}
                    </button>
                    <button type="button" className="btn btn-sm rounded-pill btn-outline-secondary" disabled>
                      👎
                    </button>
                  </div>
                  <span className="text-muted small fw-semibold">
                    {Number(snack?.comments_count ?? 0)} Comments
                  </span>
                </div>
                <div className="d-flex gap-2 mb-3 student-comment-input-row">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Add a comment..."
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") addComment();
                    }}
                  />
                  <button type="button" className="btn btn-primary" onClick={() => addComment()}>
                    Comment
                  </button>
                </div>
                <div
                  ref={commentsScrollRef}
                  className="student-comments-list sell-snack-comments-scroll"
                  onScroll={handleCommentsScroll}
                >
                  {comments.length === 0 && !commentsLoading ? (
                    <p className="text-muted small mb-0">No comments yet.</p>
                  ) : (
                    comments.map((comment) => (
                      <Fragment key={String(comment.id)}>
                        {renderCommentCard(comment, { depth: 0 })}
                      </Fragment>
                    ))
                  )}
                  {commentsLoading && (
                    <p className="text-muted small mb-0 mt-2">
                      {comments.length ? "Loading more comments…" : "Loading comments…"}
                    </p>
                  )}
                </div>
                {snack?.processing_status === "processing" && (
                  <div className="alert alert-info py-2 mb-0 mt-2">
                    HD qualities are processing. Original video is available now.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="lms-card p-4 sell-snack-suggested-sidebar">
              <h2 className="h6 fw-bold mb-3 text-uppercase text-muted small">Next suggested video</h2>
              <div
                ref={suggestionsScrollRef}
                className="sell-snack-suggested-scroll"
                onScroll={handleSuggestionsScroll}
              >
                {suggestedSnacks.length === 0 && !suggestionsLoading ? (
                  <p className="text-muted small mb-0">No other snacks available yet.</p>
                ) : (
                  <ul className="list-unstyled mb-0 sell-snack-suggested-list">
                    {suggestedSnacks.map((item) => (
                      <li key={item.id} className="mb-3">
                        <Link
                          to={`${detailBasePath}/${item.id}`}
                          className="text-decoration-none text-reset d-flex gap-3 sell-snack-suggested-row"
                        >
                          <div
                            className="sell-snack-suggested-thumb flex-shrink-0 rounded overflow-hidden bg-secondary"
                            style={{
                              width: 112,
                              height: 63,
                              background: item.thumbnail_url
                                ? `url(${item.thumbnail_url}) center/cover no-repeat`
                                : "linear-gradient(135deg,#4169ff,#f7efe1)",
                            }}
                          />
                          <div className="min-w-0">
                            <p className="small text-muted text-uppercase mb-1">{item.category}</p>
                            <p className="fw-semibold mb-1 small sell-snack-suggested-title">{item.title}</p>
                            <p className="mb-0 small text-muted">
                              👍 {Number(item.likes_count || 0)} · 💬 {Number(item.comments_count || 0)}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {suggestionsLoading && (
                  <p className="text-muted small mb-0 mt-2">
                    {suggestedSnacks.length ? "Loading more…" : "Loading suggestions…"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <CommentReportReasonModal
        open={Boolean(snackReportComment)}
        title="Report comment"
        onClose={() => {
          setSnackReportComment(null);
          setSnackReportReason("");
        }}
        selectedReason={snackReportReason}
        onSelectReason={setSnackReportReason}
        onSubmit={submitSnackCommentReport}
        reasons={REPORT_REASONS}
      />
    </DashboardSection>
  );
}

