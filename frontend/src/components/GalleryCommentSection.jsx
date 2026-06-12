import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiCornerUpLeft, FiEdit2, FiFlag, FiHeart } from "react-icons/fi";
import CommentReportReasonModal from "./CommentReportReasonModal";
import { CommentListSkeleton } from "./skeletons/LoadingSkeletons";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function nestCommentTree(flat) {
  if (!Array.isArray(flat) || flat.length === 0) return [];
  const map = new Map(flat.map((c) => [c.id, { ...c, replies: [] }]));
  const roots = [];
  for (const c of flat) {
    const node = map.get(c.id);
    const pid = c.parentId != null ? Number(c.parentId) : null;
    if (pid != null && map.has(pid)) map.get(pid).replies.push(node);
    else roots.push(node);
  }
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id - b.id);
    nodes.forEach((n) => sortNodes(n.replies));
  };
  sortNodes(roots);
  return roots;
}

function CommentThread({
  node,
  depth,
  onReply,
  onLike,
  likingCommentId,
  studentActions,
  currentUserId,
  editingCommentId,
  editDraft,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  savingEdit,
  onReport,
}) {
  const nested = depth > 0;
  const likeBusy = likingCommentId === node.id;
  const likeCount = Number(node.likes || 0);
  const isOwn = studentActions && currentUserId && Number(node.userId) === Number(currentUserId);
  const isEditing = editingCommentId === node.id;

  return (
    <div className={nested ? "gallery-comment-branch" : "gallery-comment-root"}>
      <div className="gallery-comment">
        <div className="gallery-comment-avatar" aria-hidden>
          {String(node.userName || "U").slice(0, 1).toUpperCase()}
        </div>
        <div className="gallery-comment-body">
          <div className="gallery-comment-head">
            <span className="gallery-comment-name">{node.userName || "Member"}</span>
            <span className="gallery-comment-time">{formatDate(node.createdAt)}</span>
          </div>
          {isEditing ? (
            <div className="gallery-comment-edit">
              <textarea
                className="gallery-comment-edit-input"
                rows={2}
                value={editDraft}
                onChange={(e) => onEditDraftChange(e.target.value)}
              />
              <div className="gallery-comment-edit-actions">
                <button type="button" className="gallery-comment-edit-save" disabled={savingEdit} onClick={() => onSaveEdit(node)}>
                  {savingEdit ? "Saving…" : "Save"}
                </button>
                <button type="button" className="gallery-comment-edit-cancel" disabled={savingEdit} onClick={onCancelEdit}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="gallery-comment-text">{node.body}</p>
          )}
          {!isEditing ? (
            <div className="gallery-comment-actions">
              <button
                type="button"
                className={`gallery-comment-like${node.likedByMe ? " is-liked" : ""}`}
                onClick={() => onLike(node)}
                disabled={likeBusy || node.likedByMe}
                aria-pressed={node.likedByMe}
              >
                <FiHeart aria-hidden />
                <span>{likeCount > 0 ? likeCount : "Like"}</span>
              </button>
              <button type="button" className="gallery-comment-reply" onClick={() => onReply(node)}>
                <FiCornerUpLeft aria-hidden />
                Reply
              </button>
              {studentActions && isOwn ? (
                <button type="button" className="gallery-comment-edit-btn" onClick={() => onStartEdit(node)}>
                  <FiEdit2 aria-hidden />
                  Edit
                </button>
              ) : null}
              {studentActions && !isOwn ? (
                <button type="button" className="gallery-comment-report-btn" onClick={() => onReport(node)}>
                  <FiFlag aria-hidden />
                  Report
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {node.replies?.length ? (
        <div className="gallery-comment-replies">
          {node.replies.map((r) => (
            <CommentThread
              key={r.id}
              node={r}
              depth={depth + 1}
              onReply={onReply}
              onLike={onLike}
              likingCommentId={likingCommentId}
              studentActions={studentActions}
              currentUserId={currentUserId}
              editingCommentId={editingCommentId}
              editDraft={editDraft}
              onEditDraftChange={onEditDraftChange}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              savingEdit={savingEdit}
              onReport={onReport}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function GalleryCommentSection({
  apiBaseUrl,
  commentsEndpoint,
  postEndpoint,
  likeCommentEndpoint,
  title = "Comments",
  studentActions = false,
}) {
  const composerRef = useRef(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [posting, setPosting] = useState(false);
  const [likingCommentId, setLikingCommentId] = useState(null);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [reportComment, setReportComment] = useState(null);
  const [reportReason, setReportReason] = useState("");

  const currentUserId = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return Number(u.id) || null;
    } catch {
      return null;
    }
  }, []);

  const tree = useMemo(() => nestCommentTree(comments), [comments]);

  const loadComments = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${apiBaseUrl}${commentsEndpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        setComments([]);
        setErr(payload.message || "Could not load comments.");
        return;
      }
      setComments(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setComments([]);
      setErr("Could not load comments.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, commentsEndpoint]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const postComment = async () => {
    const text = draft.trim();
    if (!text) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setPosting(true);
    try {
      const res = await fetch(`${apiBaseUrl}${postEndpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          body: text,
          ...(replyTo?.id ? { parentId: replyTo.id } : {}),
        }),
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        setErr(payload.message || "Could not post comment.");
        return;
      }
      setDraft("");
      setReplyTo(null);
      await loadComments();
    } catch {
      setErr("Could not post comment.");
    } finally {
      setPosting(false);
    }
  };

  const handleCommentLike = async (node) => {
    if (node.likedByMe) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setLikingCommentId(node.id);
    try {
      const res = await fetch(`${apiBaseUrl}${likeCommentEndpoint(node.id)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") return;
      const updated = payload.data;
      if (updated) {
        setComments((prev) => prev.map((c) => (Number(c.id) === Number(updated.id) ? { ...c, ...updated } : c)));
      }
    } finally {
      setLikingCommentId(null);
    }
  };

  const handleReply = (node) => {
    setReplyTo({ id: node.id, userName: node.userName || "Member" });
    setEditingCommentId(null);
    setEditDraft("");
    window.setTimeout(() => composerRef.current?.focus(), 0);
  };

  const handleStartEdit = (node) => {
    setEditingCommentId(node.id);
    setEditDraft(node.body || "");
    setReplyTo(null);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditDraft("");
  };

  const handleSaveEdit = async (node) => {
    const text = editDraft.trim();
    if (!text || !node?.id) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/gallery/comments/${node.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: text }),
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        setErr(payload.message || "Could not save comment.");
        return;
      }
      const updated = payload.data;
      if (updated) {
        setComments((prev) => prev.map((c) => (Number(c.id) === Number(updated.id) ? { ...c, ...updated } : c)));
      }
      setEditingCommentId(null);
      setEditDraft("");
    } catch {
      setErr("Could not save comment.");
    } finally {
      setSavingEdit(false);
    }
  };

  const submitReport = async () => {
    const cid = reportComment?.id;
    if (!reportReason.trim() || !cid) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/gallery/comments/${cid}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reportReason }),
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        setErr(payload.message || "Could not submit report.");
        return;
      }
      setNotice("Thanks — your report was submitted for review.");
      setReportComment(null);
      setReportReason("");
    } catch {
      setErr("Could not submit report.");
    }
  };

  return (
    <section className="gallery-comments-section" aria-label={title}>
      <h3 className="gallery-comments-heading">{title}</h3>
      {notice ? <p className="gallery-comments-notice">{notice}</p> : null}
      {err ? <p className="gallery-comments-err">{err}</p> : null}
      {loading ? <CommentListSkeleton count={3} /> : null}
      {!loading && tree.length === 0 ? (
        <p className="gallery-comments-muted">No comments yet. Be the first to comment.</p>
      ) : null}
      {!loading
        ? tree.map((c) => (
            <CommentThread
              key={c.id}
              node={c}
              depth={0}
              onReply={handleReply}
              onLike={handleCommentLike}
              likingCommentId={likingCommentId}
              studentActions={studentActions}
              currentUserId={currentUserId}
              editingCommentId={editingCommentId}
              editDraft={editDraft}
              onEditDraftChange={setEditDraft}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              savingEdit={savingEdit}
              onReport={(node) => {
                setReportComment(node);
                setReportReason("");
              }}
            />
          ))
        : null}
      <div className="gallery-compose">
        {replyTo ? (
          <div className="gallery-compose-replying">
            <span>
              Replying to <span className="gallery-compose-replying-name">{replyTo.userName}</span>
            </span>
            <button type="button" className="gallery-compose-cancel" onClick={() => setReplyTo(null)}>
              Cancel
            </button>
          </div>
        ) : null}
        <textarea
          ref={composerRef}
          className="gallery-compose-input"
          rows={2}
          placeholder={replyTo ? `Reply to ${replyTo.userName}…` : "Write a comment…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              postComment();
            }
          }}
        />
        <button type="button" className="gallery-compose-post" disabled={posting || !draft.trim()} onClick={postComment}>
          {posting ? "Posting…" : replyTo ? "Reply" : "Post"}
        </button>
      </div>

      {studentActions ? (
        <CommentReportReasonModal
          open={Boolean(reportComment)}
          title="Report comment"
          onClose={() => {
            setReportComment(null);
            setReportReason("");
          }}
          selectedReason={reportReason}
          onSelectReason={setReportReason}
          onSubmit={submitReport}
        />
      ) : null}
    </section>
  );
}
