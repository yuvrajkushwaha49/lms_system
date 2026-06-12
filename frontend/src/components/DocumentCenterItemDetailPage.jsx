import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiBookmark,
  FiExternalLink,
  FiFileText,
  FiHeart,
  FiImage,
  FiLink,
  FiMessageCircle,
  FiMoreHorizontal,
  FiPaperclip,
  FiSmile,
  FiVideo,
  FiCornerUpLeft,
} from "react-icons/fi";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { resolvePublicMediaUrl } from "../utils/mediaUrl";
import { CommentListSkeleton, DocCenterDetailSkeleton } from "./skeletons/LoadingSkeletons";

const HELP_BULLETS = [
  "Build trust with your audience through a polished year-end story.",
  "Showcase wins and milestones without starting from a blank page.",
  "Stay on-brand with copy you can customize in minutes.",
];

const STEPS_BULLETS = [
  "Drag and drop your photos or brand screenshots into the template.",
  "Edit headlines and colors to match your brokerage or team.",
  "Export or save as PNG for social, email, or your website.",
  "Share the link or file directly with leads and clients.",
];

const BOOKMARK_KEY = "docCenterBookmarkIds";

function formatDetailDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function engagementLine(likes, comments) {
  const l = Number(likes) || 0;
  const c = Number(comments) || 0;
  const likeWord = l === 1 ? "1 like" : `${l} likes`;
  const comWord = c === 1 ? "1 comment" : `${c} comments`;
  return `${likeWord} · ${comWord}`;
}

/** Build tree from flat list (parentId → nested replies). */
function nestCommentTree(flat) {
  if (!Array.isArray(flat) || flat.length === 0) return [];
  const map = new Map(flat.map((c) => [c.id, { ...c, replies: [] }]));
  const roots = [];
  for (const c of flat) {
    const node = map.get(c.id);
    const pid = c.parentId != null ? Number(c.parentId) : null;
    if (pid != null && map.has(pid)) {
      map.get(pid).replies.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (ta !== tb) return ta - tb;
      return a.id - b.id;
    });
    nodes.forEach((n) => sortNodes(n.replies));
  };
  sortNodes(roots);
  return roots;
}

function CommentThread({ node, depth, formatDetailDate, onReply, onLike, likingCommentId }) {
  const nested = depth > 0;
  const likeBusy = likingCommentId === node.id;
  const likeCount = Number(node.likes || 0);
  return (
    <div className={nested ? "dc-feed-comment-branch" : "dc-feed-comment-root"}>
      <div className="dc-feed-comment">
        <div className="dc-feed-comment-avatar" aria-hidden>
          {String(node.userName || "U")
            .slice(0, 1)
            .toUpperCase()}
        </div>
        <div className="dc-feed-comment-body">
          <div className="dc-feed-comment-head">
            <span className="dc-feed-comment-name">{node.userName || "Member"}</span>
            <span className="dc-feed-comment-time">{formatDetailDate(node.createdAt)}</span>
          </div>
          <p className="dc-feed-comment-text">{node.body}</p>
          <div className="dc-feed-comment-actions">
            <button
              type="button"
              className={`dc-feed-comment-like${node.likedByMe ? " is-liked" : ""}`}
              onClick={() => onLike(node)}
              disabled={likeBusy}
              aria-label={node.likedByMe ? "Unlike comment" : "Like comment"}
              aria-pressed={node.likedByMe}
            >
              <FiHeart className="dc-feed-comment-like-icon" aria-hidden />
              <span>{likeCount > 0 ? likeCount : "Like"}</span>
            </button>
            <button type="button" className="dc-feed-comment-reply" onClick={() => onReply(node)}>
              <FiCornerUpLeft className="dc-feed-comment-reply-icon" aria-hidden />
              Reply
            </button>
          </div>
        </div>
      </div>
      {node.replies?.length ? (
        <div className="dc-feed-comment-replies">
          {node.replies.map((r) => (
            <CommentThread
              key={r.id}
              node={r}
              depth={depth + 1}
              formatDetailDate={formatDetailDate}
              onReply={onReply}
              onLike={onLike}
              likingCommentId={likingCommentId}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function fileExtFromUrl(nameOrUrl) {
  const s = String(nameOrUrl || "");
  const m = s.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
}

export default function DocumentCenterItemDetailPage({ variant }) {
  const isAdmin = variant === "admin";
  const { itemId } = useParams();
  const navigate = useNavigate();
  const id = Number(itemId);
  const listPath = isAdmin ? "/dashboard/document-center-management" : "/dashboard/student-document-center";

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const composerRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [likers, setLikers] = useState([]);

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [posting, setPosting] = useState(false);
  const [likingCommentId, setLikingCommentId] = useState(null);
  const [bookmarked, setBookmarked] = useState(false);

  const commentTree = useMemo(() => nestCommentTree(comments), [comments]);

  const sessionUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const displayName = String(sessionUser.name || sessionUser.email || "You").trim() || "You";
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  const showNotice = useCallback((msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 4500);
  }, []);

  const handleReply = useCallback((node) => {
    setReplyTo({ id: node.id, userName: node.userName || "Member" });
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#compose`);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }, []);

  const mergeCommentLike = useCallback((commentId, patch) => {
    setComments((prev) =>
      prev.map((c) => (Number(c.id) === Number(commentId) ? { ...c, ...patch } : c)),
    );
  }, []);

  const handleCommentLike = useCallback(
    async (node) => {
      if (!doc || node.likedByMe) return;
      const token = localStorage.getItem("token");
      if (!token) return;
      setLikingCommentId(node.id);
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/document-center/items/${doc.id}/comments/${node.id}/like`,
          { method: "POST", headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = await res.json();
        if (!res.ok || payload.status !== "success") {
          showNotice(payload.message || "Could not update like.");
          return;
        }
        if (payload.alreadyLiked) {
          showNotice("You already liked this comment.");
        }
        const updated = payload.data;
        if (updated) mergeCommentLike(updated.id, updated);
      } catch {
        showNotice("Could not update like. Try again.");
      } finally {
        setLikingCommentId(null);
      }
    },
    [apiBaseUrl, doc, mergeCommentLike, showNotice],
  );

  const loadDoc = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) {
      setErr("Invalid document link.");
      setLoading(false);
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      setErr("Please sign in to view this document.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${apiBaseUrl}/api/document-center/items/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Document not found.");
      }
      setDoc(payload.data || null);
    } catch (e) {
      setErr(e.message || "Could not load document.");
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, id]);

  const loadComments = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setCommentsLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/document-center/items/${id}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        setComments([]);
        return;
      }
      setComments(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [apiBaseUrl, id]);

  const loadLikes = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/document-center/items/${id}/likes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        setLikers([]);
        return;
      }
      setLikers(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setLikers([]);
    }
  }, [apiBaseUrl, id]);

  useEffect(() => {
    loadDoc();
  }, [loadDoc]);

  useEffect(() => {
    if (!loading && doc) loadComments();
  }, [loading, doc, loadComments]);

  useEffect(() => {
    if (!loading && doc) loadLikes();
  }, [loading, doc, loadLikes]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARK_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setBookmarked(Array.isArray(arr) && arr.includes(id));
    } catch {
      setBookmarked(false);
    }
  }, [id]);

  useEffect(() => {
    if (window.location.hash === "#compose" && doc && composerRef.current) {
      window.setTimeout(() => composerRef.current?.focus(), 300);
    }
  }, [doc]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const fileHref = doc?.fileUrl ? resolvePublicMediaUrl(doc.fileUrl, apiBaseUrl) : "";
  const ext = fileExtFromUrl(doc?.fileName || doc?.fileUrl || "");
  const isImagePreview = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
  const isPdfPreview = ext === "pdf";

  const toggleBookmark = () => {
    try {
      const raw = localStorage.getItem(BOOKMARK_KEY);
      let arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) arr = [];
      if (arr.includes(id)) {
        arr = arr.filter((x) => x !== id);
        setBookmarked(false);
      } else {
        arr = [...arr, id];
        setBookmarked(true);
      }
      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(arr));
    } catch {
      /* ignore */
    }
  };

  const bumpLike = async () => {
    if (!doc) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/document-center/items/${doc.id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        showNotice(payload.message || "Could not update like.");
        return;
      }
      if (payload.alreadyLiked) {
        showNotice("You already liked this.");
      }
      setDoc((d) => (d ? { ...d, ...payload.data } : d));
      await loadLikes();
    } catch {
      showNotice("Could not update like. Try again.");
    }
  };

  const scrollToCompose = () => {
    setReplyTo(null);
    composerRef.current?.focus();
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#compose`);
  };

  const postComment = async () => {
    const text = draft.trim();
    if (!doc || !text) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setPosting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/document-center/items/${doc.id}/comments`, {
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
        showNotice(payload.message || "Could not post comment.");
        return;
      }
      const { item } = payload.data || {};
      if (item) setDoc((d) => (d ? { ...d, ...item } : d));
      setDraft("");
      setReplyTo(null);
      await loadComments();
    } catch {
      showNotice("Could not post comment. Try again.");
    } finally {
      setPosting(false);
    }
  };

  const copyPageLink = () => {
    const url = window.location.href.split("#")[0];
    navigator.clipboard?.writeText(url).then(
      () => showNotice("Link copied."),
      () => showNotice("Could not copy link."),
    );
    setMenuOpen(false);
  };

  return (
    <div className="doc-center-page dc-feed-page">
      <div className="dc-feed-toolbar">
        <button type="button" className="doc-center-detail-back" onClick={() => navigate(listPath)}>
          <FiArrowLeft aria-hidden />
          Back
        </button>
      </div>

      {notice ? (
        <div className="doc-center-alert doc-center-alert--warn" role="status">
          {notice}
        </div>
      ) : null}

      {loading ? <DocCenterDetailSkeleton /> : null}

      {!loading && err ? (
        <div className="doc-center-empty-state doc-center-detail-error">
          <p className="doc-center-empty-title mb-2">{err}</p>
          <button type="button" className="doc-center-btn-primary" onClick={() => navigate(listPath)}>
            Return to list
          </button>
        </div>
      ) : null}

      {!loading && doc ? (
        <article className="dc-feed-card">
          <div className="dc-feed-header-row">
            <h1 className="dc-feed-title">{doc.title}</h1>
            <div className="dc-feed-header-actions">
              <button
                type="button"
                className={`dc-feed-icon-btn ${bookmarked ? "is-active" : ""}`}
                aria-label={bookmarked ? "Remove bookmark" : "Save bookmark"}
                aria-pressed={bookmarked}
                onClick={toggleBookmark}
              >
                <FiBookmark aria-hidden />
              </button>
              <div className="dc-feed-more-wrap" ref={menuRef}>
                <button
                  type="button"
                  className="dc-feed-icon-btn"
                  aria-label="More"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <FiMoreHorizontal aria-hidden />
                </button>
                {menuOpen ? (
                  <div className="dc-feed-more-menu" role="menu">
                    {fileHref ? (
                      <a
                        role="menuitem"
                        className="dc-feed-more-item"
                        href={fileHref}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setMenuOpen(false)}
                      >
                        Open attachment
                      </a>
                    ) : null}
                    <button type="button" role="menuitem" className="dc-feed-more-item" onClick={copyPageLink}>
                      Copy page link
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {isAdmin && doc.isActive === false ? (
            <p className="dc-feed-hidden-banner">
              <span className="doc-center-card-hidden-pill">Hidden</span>
              <span>Students cannot see this document.</span>
            </p>
          ) : null}

          <div className="dc-feed-prose">
            <p>
              {doc.subtitle?.trim()
                ? doc.subtitle
                : `Use this ${doc.category || "template"} to share a polished story with your audience — perfect for year-end recaps, campaigns, and social proof.`}
            </p>
            <p>
              {doc.cardLabel
                ? `This pack is labeled “${doc.cardLabel}” on your catalog card so members can spot it quickly.`
                : "Customize the attached file with your branding, then export or share wherever you connect with clients."}
            </p>
          </div>

          {fileHref ? (
            <a className="dc-feed-cta" href={fileHref} target="_blank" rel="noreferrer">
              Start yours here
            </a>
          ) : (
            <span className="dc-feed-cta dc-feed-cta--disabled">No attachment yet</span>
          )}

          <section className="dc-feed-list-section">
            <h2 className="dc-feed-list-heading">This asset is designed to help you:</h2>
            <ul className="dc-feed-bullets">
              {HELP_BULLETS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="dc-feed-list-section">
            <h2 className="dc-feed-list-heading">All you need to do is:</h2>
            <ul className="dc-feed-bullets">
              {STEPS_BULLETS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          {fileHref ? (
            <div className="dc-feed-attachment">
              <div className="dc-feed-attachment-head">
                <span className="dc-feed-attachment-icon" aria-hidden>
                  <FiFileText />
                </span>
                <div className="dc-feed-attachment-meta">
                  <span className="dc-feed-attachment-name">{doc.fileName || "Attachment"}</span>
                  <span className="dc-feed-attachment-sub">Template file · Open to view or download</span>
                </div>
                <a className="dc-feed-attachment-open" href={fileHref} target="_blank" rel="noreferrer">
                  <FiExternalLink aria-hidden />
                  Open
                </a>
              </div>
              <div className="dc-feed-attachment-preview">
                {isImagePreview ? (
                  <img src={fileHref} alt="" className="dc-feed-preview-img" />
                ) : isPdfPreview ? (
                  <iframe title="Document preview" src={fileHref} className="dc-feed-preview-frame" />
                ) : (
                  <div className="dc-feed-preview-fallback">
                    <FiFileText aria-hidden />
                    <span>Preview not available for this file type. Use Open to view.</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div className="dc-feed-divider" />

          <div className="dc-feed-social-row">
            <div className="dc-feed-social-icons" role="group" aria-label="React to this template">
              <button
                type="button"
                className={`dc-feed-social-hit${doc.likedByMe ? " is-liked" : ""}`}
                onClick={bumpLike}
                aria-label="Like"
                aria-pressed={doc.likedByMe}
              >
                <FiHeart aria-hidden />
              </button>
              <button type="button" className="dc-feed-social-hit" onClick={scrollToCompose} aria-label="Comment">
                <FiMessageCircle aria-hidden />
              </button>
            </div>
            <div className="dc-feed-social-right">
              <div className="dc-feed-engage-summary">
                {likers.length > 0 ? (
                  <div className="dc-feed-avatar-stack" aria-hidden>
                    {likers.slice(0, 3).map((lk, idx) => (
                      <span
                        key={`${lk.userId}-${idx}`}
                        className={`dc-feed-avatar dc-feed-avatar--letter dc-feed-avatar--tone-${idx % 3}`}
                        title={lk.userName || "Member"}
                      >
                        {String(lk.userName || "M")
                          .trim()
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                    ))}
                    {likers.length > 3 ? (
                      <span className="dc-feed-avatar dc-feed-avatar--letter dc-feed-avatar--more" title={`${likers.length - 3} more`}>
                        +{likers.length - 3}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <span className="dc-feed-engage-text">{engagementLine(doc.likes, doc.comments)}</span>
              </div>
            </div>
          </div>

          <section className="dc-feed-thread" aria-label="Comments">
            {commentsLoading ? <CommentListSkeleton count={3} /> : null}
            {!commentsLoading &&
              commentTree.map((c) => (
                <CommentThread
                  key={c.id}
                  node={c}
                  depth={0}
                  formatDetailDate={formatDetailDate}
                  onReply={handleReply}
                  onLike={handleCommentLike}
                  likingCommentId={likingCommentId}
                />
              ))}
            {!commentsLoading && comments.length === 0 ? (
              <p className="dc-feed-thread-empty dc-feed-muted">No comments yet. Start the thread below.</p>
            ) : null}
          </section>

          <div className="dc-feed-compose" id="compose">
            <div className="dc-feed-compose-avatar" aria-hidden>
              {initials}
            </div>
            <div className="dc-feed-compose-inner">
              {replyTo ? (
                <div className="dc-feed-compose-replying">
                  <span>
                    Replying to <span className="dc-feed-compose-replying-name">{replyTo.userName}</span>
                  </span>
                  <button type="button" className="dc-feed-compose-cancel-reply" onClick={() => setReplyTo(null)}>
                    Cancel
                  </button>
                </div>
              ) : null}
              <textarea
                ref={composerRef}
                className="dc-feed-compose-input"
                rows={3}
                placeholder={replyTo ? `Reply to ${replyTo.userName}…` : "What are your thoughts?"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    postComment();
                  }
                }}
              />
              <div className="dc-feed-compose-toolbar">
                <div className="dc-feed-compose-tools">
                  <button type="button" className="dc-feed-tool-btn" aria-label="Emoji" disabled title="Coming soon">
                    <FiSmile aria-hidden />
                  </button>
                  <button type="button" className="dc-feed-tool-btn" aria-label="Link" disabled title="Coming soon">
                    <FiLink aria-hidden />
                  </button>
                  <button type="button" className="dc-feed-tool-btn" aria-label="Attach" disabled title="Coming soon">
                    <FiPaperclip aria-hidden />
                  </button>
                  <button type="button" className="dc-feed-tool-btn" aria-label="Image" disabled title="Coming soon">
                    <FiImage aria-hidden />
                  </button>
                  <button type="button" className="dc-feed-tool-btn" aria-label="Video" disabled title="Coming soon">
                    <FiVideo aria-hidden />
                  </button>
                </div>
                <button
                  type="button"
                  className="dc-feed-post-btn"
                  disabled={posting || !draft.trim()}
                  onClick={postComment}
                >
                  {posting ? "Posting…" : replyTo ? "Reply" : "Post"}
                </button>
              </div>
              <p className="dc-feed-compose-hint dc-feed-muted mb-0">Tip: Ctrl+Enter to post</p>
            </div>
          </div>
        </article>
      ) : null}
    </div>
  );
}
