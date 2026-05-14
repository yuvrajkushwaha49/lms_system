import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { resolvePublicMediaUrl } from "../utils/mediaUrl";
import { addBlockedDmMemberId, isDmBlockedMemberId } from "../utils/blockedDmMembers";
import {
  FiCalendar,
  FiClock,
  FiLink,
  FiMail,
  FiMessageCircle,
  FiMoreHorizontal,
  FiAward,
  FiX,
} from "react-icons/fi";

const PAGE_SIZE = 15;
const SCROLL_LOAD_THRESHOLD_PX = 72;

const formatMemberSince = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatShortDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const humanizeSpace = (space) => {
  const s = String(space || "").trim();
  if (!s) return "—";
  return s
    .split("-")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ");
};

/** Community-facing label: backend "Student" is shown as "Member". */
const displayRoleLabel = (role) => {
  const r = String(role ?? "").trim();
  if (!r) return "Member";
  if (r.toLowerCase() === "student") return "Member";
  return r;
};

const resolveTier = (member) => {
  const n = Number(member?.id);
  if (Number.isFinite(n) && n > 0) return (n % 9) + 1;
  return 1;
};

const createListState = () => ({
  items: [],
  nextOffset: 0,
  hasMore: true,
  loading: false,
  initialLoaded: false,
});

export default function MemberProfileModal({
  open,
  summaryMember,
  onClose,
  apiBaseUrl,
  messagesPath = "/dashboard/student-messages",
  showMessageButton = true,
  profileCopyPathname = "/dashboard/student-members",
  profileCopyQueryParam = "member",
}) {
  const [detail, setDetail] = useState(null);
  const [activeTab, setActiveTab] = useState("about");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activitySummary, setActivitySummary] = useState(null);
  const [postsState, setPostsState] = useState(createListState);
  const [commentsState, setCommentsState] = useState(createListState);
  const [spacesState, setSpacesState] = useState(createListState);
  const [rewardsState, setRewardsState] = useState(createListState);

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState("");

  const postsScrollRef = useRef(null);
  const commentsScrollRef = useRef(null);
  const spacesScrollRef = useRef(null);
  const rewardsScrollRef = useRef(null);
  const moreMenuWrapRef = useRef(null);

  const merged = useMemo(() => {
    const s = summaryMember || {};
    const d = detail || {};
    return {
      id: d.id ?? s.id,
      name: d.name ?? s.name ?? "Member",
      email: d.email ?? s.email ?? "",
      phone: d.phone ?? s.phone ?? "",
      role: d.role ?? s.role ?? "Member",
      created_at: d.created_at ?? s.created_at,
      status: d.status ?? s.status,
    };
  }, [summaryMember, detail]);

  const memberId = Number(merged.id);
  const tier = useMemo(() => resolveTier(merged), [merged]);

  const fetchProfile = useCallback(async () => {
    if (!open || !Number.isFinite(memberId) || memberId <= 0) {
      setDetail(null);
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      setLoadError("Please sign in again.");
      return;
    }
    try {
      setLoading(true);
      setLoadError("");
      const res = await fetch(`${apiBaseUrl}/api/users/members/${memberId}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Could not load profile.");
      }
      setDetail(payload.data || null);
    } catch (e) {
      setLoadError(e.message || "Could not load profile.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, open, memberId]);

  const fetchActivitySummary = useCallback(async () => {
    if (!open || !Number.isFinite(memberId) || memberId <= 0) {
      setActivitySummary(null);
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/users/members/${memberId}/activity-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") return;
      setActivitySummary(payload.data || null);
    } catch {
      setActivitySummary(null);
    }
  }, [apiBaseUrl, open, memberId]);

  const loadPosts = useCallback(
    async (reset) => {
      if (!Number.isFinite(memberId) || memberId <= 0) return;
      let offset = 0;
      let shouldAbort = false;
      setPostsState((prev) => {
        if (reset) {
          offset = 0;
          return { ...createListState(), loading: true };
        }
        if (prev.loading || !prev.hasMore) {
          shouldAbort = true;
          return prev;
        }
        offset = prev.nextOffset;
        return { ...prev, loading: true };
      });
      if (shouldAbort) return;
      const token = localStorage.getItem("token");
      if (!token) {
        setPostsState((p) => ({ ...p, loading: false, initialLoaded: true }));
        return;
      }
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        const res = await fetch(
          `${apiBaseUrl}/api/users/members/${memberId}/feed-posts?${params}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = await res.json();
        if (!res.ok || payload.status !== "success") {
          throw new Error(payload.message || "Could not load posts.");
        }
        const rows = Array.isArray(payload.data) ? payload.data : [];
        const hasMore = Boolean(payload.pagination?.has_more);
        const nextOffset = Number(
          payload.pagination?.next_offset ?? offset + rows.length,
        );
        setPostsState((prev) => {
          if (reset) {
            return {
              items: rows,
              nextOffset,
              hasMore,
              loading: false,
              initialLoaded: true,
            };
          }
          return {
            items: [...prev.items, ...rows],
            nextOffset,
            hasMore,
            loading: false,
            initialLoaded: true,
          };
        });
      } catch {
        setPostsState((prev) => ({
          ...prev,
          loading: false,
          initialLoaded: true,
          hasMore: false,
        }));
      }
    },
    [apiBaseUrl, memberId],
  );

  const loadComments = useCallback(
    async (reset) => {
      if (!Number.isFinite(memberId) || memberId <= 0) return;
      let offset = 0;
      let shouldAbort = false;
      setCommentsState((prev) => {
        if (reset) {
          offset = 0;
          return { ...createListState(), loading: true };
        }
        if (prev.loading || !prev.hasMore) {
          shouldAbort = true;
          return prev;
        }
        offset = prev.nextOffset;
        return { ...prev, loading: true };
      });
      if (shouldAbort) return;
      const token = localStorage.getItem("token");
      if (!token) {
        setCommentsState((p) => ({ ...p, loading: false, initialLoaded: true }));
        return;
      }
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        const res = await fetch(
          `${apiBaseUrl}/api/users/members/${memberId}/feed-comments?${params}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = await res.json();
        if (!res.ok || payload.status !== "success") {
          throw new Error(payload.message || "Could not load comments.");
        }
        const rows = Array.isArray(payload.data) ? payload.data : [];
        const hasMore = Boolean(payload.pagination?.has_more);
        const nextOffset = Number(
          payload.pagination?.next_offset ?? offset + rows.length,
        );
        setCommentsState((prev) => {
          if (reset) {
            return {
              items: rows,
              nextOffset,
              hasMore,
              loading: false,
              initialLoaded: true,
            };
          }
          return {
            items: [...prev.items, ...rows],
            nextOffset,
            hasMore,
            loading: false,
            initialLoaded: true,
          };
        });
      } catch {
        setCommentsState((prev) => ({
          ...prev,
          loading: false,
          initialLoaded: true,
          hasMore: false,
        }));
      }
    },
    [apiBaseUrl, memberId],
  );

  const loadSpaces = useCallback(
    async (reset) => {
      if (!Number.isFinite(memberId) || memberId <= 0) return;
      let offset = 0;
      let shouldAbort = false;
      setSpacesState((prev) => {
        if (reset) {
          offset = 0;
          return { ...createListState(), loading: true };
        }
        if (prev.loading || !prev.hasMore) {
          shouldAbort = true;
          return prev;
        }
        offset = prev.nextOffset;
        return { ...prev, loading: true };
      });
      if (shouldAbort) return;
      const token = localStorage.getItem("token");
      if (!token) {
        setSpacesState((p) => ({ ...p, loading: false, initialLoaded: true }));
        return;
      }
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        const res = await fetch(
          `${apiBaseUrl}/api/users/members/${memberId}/posting-spaces?${params}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = await res.json();
        if (!res.ok || payload.status !== "success") {
          throw new Error(payload.message || "Could not load spaces.");
        }
        const rows = Array.isArray(payload.data) ? payload.data : [];
        const hasMore = Boolean(payload.pagination?.has_more);
        const nextOffset = Number(
          payload.pagination?.next_offset ?? offset + rows.length,
        );
        setSpacesState((prev) => {
          if (reset) {
            return {
              items: rows,
              nextOffset,
              hasMore,
              loading: false,
              initialLoaded: true,
            };
          }
          return {
            items: [...prev.items, ...rows],
            nextOffset,
            hasMore,
            loading: false,
            initialLoaded: true,
          };
        });
      } catch {
        setSpacesState((prev) => ({
          ...prev,
          loading: false,
          initialLoaded: true,
          hasMore: false,
        }));
      }
    },
    [apiBaseUrl, memberId],
  );

  const loadRewards = useCallback(
    async (reset) => {
      if (!Number.isFinite(memberId) || memberId <= 0) return;
      let offset = 0;
      let shouldAbort = false;
      setRewardsState((prev) => {
        if (reset) {
          offset = 0;
          return { ...createListState(), loading: true };
        }
        if (prev.loading || !prev.hasMore) {
          shouldAbort = true;
          return prev;
        }
        offset = prev.nextOffset;
        return { ...prev, loading: true };
      });
      if (shouldAbort) return;
      const token = localStorage.getItem("token");
      if (!token) {
        setRewardsState((p) => ({ ...p, loading: false, initialLoaded: true }));
        return;
      }
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        const res = await fetch(
          `${apiBaseUrl}/api/users/members/${memberId}/wall-of-wins?${params}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = await res.json();
        if (!res.ok || payload.status !== "success") {
          throw new Error(payload.message || "Could not load rewards.");
        }
        const rows = Array.isArray(payload.data) ? payload.data : [];
        const hasMore = Boolean(payload.pagination?.has_more);
        const nextOffset = Number(
          payload.pagination?.next_offset ?? offset + rows.length,
        );
        setRewardsState((prev) => {
          if (reset) {
            return {
              items: rows,
              nextOffset,
              hasMore,
              loading: false,
              initialLoaded: true,
            };
          }
          return {
            items: [...prev.items, ...rows],
            nextOffset,
            hasMore,
            loading: false,
            initialLoaded: true,
          };
        });
      } catch {
        setRewardsState((prev) => ({
          ...prev,
          loading: false,
          initialLoaded: true,
          hasMore: false,
        }));
      }
    },
    [apiBaseUrl, memberId],
  );

  useEffect(() => {
    if (!open) {
      setDetail(null);
      setLoadError("");
      setActiveTab("about");
      setActivitySummary(null);
      setPostsState(createListState());
      setCommentsState(createListState());
      setSpacesState(createListState());
      setRewardsState(createListState());
      setMoreMenuOpen(false);
      setActionNotice("");
      return;
    }
    fetchProfile();
    fetchActivitySummary();
  }, [open, fetchProfile, fetchActivitySummary]);

  useEffect(() => {
    if (!open || !Number.isFinite(memberId) || memberId <= 0) return;
    if (activeTab === "posts" && !postsState.initialLoaded && !postsState.loading) {
      loadPosts(true);
    }
    if (activeTab === "comments" && !commentsState.initialLoaded && !commentsState.loading) {
      loadComments(true);
    }
    if (activeTab === "spaces" && !spacesState.initialLoaded && !spacesState.loading) {
      loadSpaces(true);
    }
    if (activeTab === "rewards" && !rewardsState.initialLoaded && !rewardsState.loading) {
      loadRewards(true);
    }
  }, [
    open,
    memberId,
    activeTab,
    postsState.initialLoaded,
    postsState.loading,
    commentsState.initialLoaded,
    commentsState.loading,
    spacesState.initialLoaded,
    spacesState.loading,
    rewardsState.initialLoaded,
    rewardsState.loading,
    loadPosts,
    loadComments,
    loadSpaces,
    loadRewards,
  ]);

  const handleScrollLoad = useCallback(
    (el, state, loadMore) => {
      if (!el || state.loading || !state.hasMore || !state.initialLoaded) return;
      const { scrollTop, clientHeight, scrollHeight } = el;
      if (scrollTop + clientHeight >= scrollHeight - SCROLL_LOAD_THRESHOLD_PX) {
        loadMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open || !moreMenuOpen) return undefined;
    const onPointerDown = (e) => {
      if (!moreMenuWrapRef.current?.contains(e.target)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, moreMenuOpen]);

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
      if (e.key === "Escape") {
        if (moreMenuOpen) {
          setMoreMenuOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, moreMenuOpen]);

  const buildProfileShareUrl = useCallback(() => {
    if (typeof window === "undefined") return "";
    try {
      const path =
        String(profileCopyPathname || "").trim() || "/dashboard/student-members";
      const u = new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin);
      u.searchParams.set(String(profileCopyQueryParam || "member"), String(memberId));
      return u.toString();
    } catch {
      return "";
    }
  }, [profileCopyPathname, profileCopyQueryParam, memberId]);

  const handleCopyProfileLink = useCallback(async () => {
    const url = buildProfileShareUrl();
    if (!url) return;
    setMoreMenuOpen(false);
    try {
      await navigator.clipboard.writeText(url);
      setActionNotice("Link copied to clipboard.");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setActionNotice("Link copied to clipboard.");
      } catch {
        setActionNotice("Could not copy link. Please copy manually.");
      }
    }
  }, [buildProfileShareUrl]);

  const handleBlockDirectMessages = useCallback(() => {
    if (!Number.isFinite(memberId) || memberId <= 0) return;
    if (isDmBlockedMemberId(memberId)) {
      setMoreMenuOpen(false);
      setActionNotice("Direct messages from this member are already blocked on this browser.");
      return;
    }
    addBlockedDmMemberId(memberId);
    window.dispatchEvent(new CustomEvent("lms-dm-block-updated"));
    setMoreMenuOpen(false);
    const label = merged.name || "This member";
    setActionNotice(`Direct messages from ${label} are blocked on this device.`);
  }, [memberId, merged.name]);

  useEffect(() => {
    if (!actionNotice) return undefined;
    const t = window.setTimeout(() => setActionNotice(""), 4800);
    return () => window.clearTimeout(t);
  }, [actionNotice]);

  if (!open || !summaryMember) return null;

  const headline =
    String(merged.role || "").toLowerCase() === "student"
      ? "Learning fast. Selling smart."
      : `${displayRoleLabel(merged.role)} · Community member`;

  const bio =
    "From building community to building deals — connect in Sell It Community and keep your profile up to date in account settings.";

  const countLabel = (key) => {
    if (!activitySummary) return "…";
    return String(activitySummary[key] ?? 0);
  };

  const tabs = [
    { id: "about", label: "About" },
    { id: "posts", label: "Posts", count: countLabel("posts") },
    { id: "comments", label: "Comments", count: countLabel("comments") },
    { id: "spaces", label: "Spaces", count: countLabel("spaces") },
    { id: "rewards", label: "Rewards", count: countLabel("rewards") },
  ];

  const currentUserId = Number(JSON.parse(localStorage.getItem("user") || "{}")?.id || 0);
  const blockDmDisabled =
    !showMessageButton ||
    !(Number.isFinite(memberId) && memberId > 0) ||
    (Number.isFinite(currentUserId) && currentUserId > 0 && memberId === currentUserId);

  return (
    <div className="member-profile-modal-layer" role="presentation">
      <button
        type="button"
        className="member-profile-modal-backdrop"
        aria-label="Close profile"
        onClick={onClose}
      />
      <div
        className="member-profile-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-profile-modal-title"
      >
        <header className="member-profile-modal-header">
          <h2 id="member-profile-modal-title" className="member-profile-modal-title">
            Profile
          </h2>
          <button
            type="button"
            className="member-profile-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <FiX />
          </button>
        </header>

        <div className="member-profile-modal-body">
          <aside className="member-profile-modal-sidebar">
            <div className="member-profile-modal-avatar-wrap">
              <div className="member-profile-modal-avatar-ring">
                <span className="member-profile-modal-avatar-letter">
                  {String(merged.name || merged.email || "M")
                    .trim()
                    .charAt(0)
                    .toUpperCase() || "M"}
                </span>
              </div>
              <span className="member-profile-modal-level-badge">{tier}</span>
            </div>
            <h3 className="member-profile-modal-sidebar-name">{merged.name}</h3>
            <p className="member-profile-modal-meta">
              <FiClock aria-hidden className="member-profile-modal-meta-icon" />
              <span>Last seen —</span>
            </p>
            <p className="member-profile-modal-meta">
              <FiCalendar aria-hidden className="member-profile-modal-meta-icon" />
              <span>Member since {formatMemberSince(merged.created_at)}</span>
            </p>
            <span className="member-profile-modal-role-pill">{displayRoleLabel(merged.role)}</span>
            <div className="member-profile-modal-sidebar-actions" ref={moreMenuWrapRef}>
              {showMessageButton ? (
                <Link to={messagesPath} className="member-profile-modal-btn-message" onClick={onClose}>
                  Message
                </Link>
              ) : null}
              <div className="member-profile-more-wrap">
                <button
                  type="button"
                  className="member-profile-modal-btn-more"
                  aria-label="More options"
                  aria-expanded={moreMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setMoreMenuOpen((v) => !v)}
                >
                  <FiMoreHorizontal />
                </button>
                {moreMenuOpen ? (
                  <div className="member-profile-more-menu" role="menu">
                    <button
                      type="button"
                      className="member-profile-more-item"
                      role="menuitem"
                      onClick={handleCopyProfileLink}
                    >
                      <FiLink className="member-profile-more-item-icon" aria-hidden />
                      <span>Copy link to profile</span>
                    </button>
                    {showMessageButton ? (
                      <button
                        type="button"
                        className="member-profile-more-item member-profile-more-item--danger"
                        role="menuitem"
                        disabled={blockDmDisabled}
                        onClick={() => {
                          if (!blockDmDisabled) handleBlockDirectMessages();
                        }}
                      >
                        <span className="member-profile-more-icon-block" aria-hidden>
                          <FiMessageCircle className="member-profile-more-icon-block-bubble" />
                          <FiX className="member-profile-more-icon-block-x" />
                        </span>
                        <span>Block direct messages</span>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            {actionNotice ? (
              <p className="member-profile-modal-action-notice" role="status">
                {actionNotice}
              </p>
            ) : null}
          </aside>

          <div className="member-profile-modal-main">
            <nav className="member-profile-modal-tabs" aria-label="Profile sections">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`member-profile-modal-tab ${activeTab === tab.id ? "is-active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  {tab.count != null ? <span className="member-profile-modal-tab-count"> {tab.count}</span> : null}
                </button>
              ))}
            </nav>

            {activeTab === "about" && (
              <div className="member-profile-modal-about">
                {loading && <p className="text-muted small mb-3">Loading profile…</p>}
                {loadError && !loading ? (
                  <p className="text-danger small mb-3">{loadError}</p>
                ) : null}

                <div className="member-profile-modal-status-row">
                  <div className="member-profile-modal-status-pill" aria-hidden>
                    <FiAward className="member-profile-modal-trophy" />
                    <span>{tier}</span>
                    <span className="member-profile-modal-pill-divider" />
                    <span>Sell It status</span>
                  </div>
                  <p className="member-profile-modal-points">— points · — to level up</p>
                </div>

                {merged.email ? (
                  <p className="member-profile-modal-email">
                    <FiMail aria-hidden className="member-profile-modal-meta-icon" />
                    <span>{merged.email}</span>
                  </p>
                ) : null}

                <dl className="member-profile-modal-dl">
                  <div className="member-profile-modal-dl-row">
                    <dt>Tags</dt>
                    <dd>
                      <span className="member-profile-modal-role-pill member-profile-modal-role-pill--inline">
                        {displayRoleLabel(merged.role)}
                      </span>
                    </dd>
                  </div>
                  <div className="member-profile-modal-dl-row">
                    <dt>Headline</dt>
                    <dd>{headline}</dd>
                  </div>
                  <div className="member-profile-modal-dl-row">
                    <dt>Bio</dt>
                    <dd>{bio}</dd>
                  </div>
                  <div className="member-profile-modal-dl-row">
                    <dt>Location</dt>
                    <dd>—</dd>
                  </div>
                  <div className="member-profile-modal-dl-row">
                    <dt>Company</dt>
                    <dd>—</dd>
                  </div>
                  {merged.phone ? (
                    <div className="member-profile-modal-dl-row">
                      <dt>Phone</dt>
                      <dd>{merged.phone}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            )}

            {activeTab === "posts" && (
              <div
                ref={postsScrollRef}
                className="member-profile-tab-scroll"
                onScroll={() => handleScrollLoad(postsScrollRef.current, postsState, loadPosts)}
              >
                {postsState.loading && postsState.items.length === 0 ? (
                  <p className="text-muted small py-3 mb-0">Loading posts…</p>
                ) : postsState.items.length === 0 ? (
                  <p className="text-muted small py-3 mb-0">No community posts yet.</p>
                ) : (
                  <ul className="member-profile-activity-list list-unstyled mb-0">
                    {postsState.items.map((row) => (
                      <li key={row.id} className="member-profile-activity-row">
                        <div className="member-profile-activity-row-title">{row.heading || "Untitled"}</div>
                        <div className="member-profile-activity-row-meta">
                          <span>{humanizeSpace(row.posting_space)}</span>
                          <span className="text-muted">·</span>
                          <span>{formatShortDateTime(row.created_at)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {postsState.loading && postsState.items.length > 0 ? (
                  <p className="text-muted small py-2 mb-0 text-center">Loading more…</p>
                ) : null}
              </div>
            )}

            {activeTab === "comments" && (
              <div
                ref={commentsScrollRef}
                className="member-profile-tab-scroll"
                onScroll={() =>
                  handleScrollLoad(commentsScrollRef.current, commentsState, loadComments)
                }
              >
                {commentsState.loading && commentsState.items.length === 0 ? (
                  <p className="text-muted small py-3 mb-0">Loading comments…</p>
                ) : commentsState.items.length === 0 ? (
                  <p className="text-muted small py-3 mb-0">No feed comments yet.</p>
                ) : (
                  <ul className="member-profile-activity-list list-unstyled mb-0">
                    {commentsState.items.map((row) => (
                      <li key={row.id} className="member-profile-activity-row">
                        <div className="member-profile-activity-row-title">
                          On: {row.post_heading || "Post"}
                        </div>
                        <div className="member-profile-activity-row-body">
                          {String(row.comment_text || "").slice(0, 220)}
                          {String(row.comment_text || "").length > 220 ? "…" : ""}
                        </div>
                        <div className="member-profile-activity-row-meta">
                          <span>{formatShortDateTime(row.created_at)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {commentsState.loading && commentsState.items.length > 0 ? (
                  <p className="text-muted small py-2 mb-0 text-center">Loading more…</p>
                ) : null}
              </div>
            )}

            {activeTab === "spaces" && (
              <div
                ref={spacesScrollRef}
                className="member-profile-tab-scroll"
                onScroll={() => handleScrollLoad(spacesScrollRef.current, spacesState, loadSpaces)}
              >
                {spacesState.loading && spacesState.items.length === 0 ? (
                  <p className="text-muted small py-3 mb-0">Loading spaces…</p>
                ) : spacesState.items.length === 0 ? (
                  <p className="text-muted small py-3 mb-0">No posting spaces yet.</p>
                ) : (
                  <ul className="member-profile-activity-list list-unstyled mb-0">
                    {spacesState.items.map((row) => (
                      <li key={row.space} className="member-profile-activity-row">
                        <div className="member-profile-activity-row-title">{humanizeSpace(row.space)}</div>
                        <div className="member-profile-activity-row-meta">
                          <span>{Number(row.post_count) || 0} posts</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {spacesState.loading && spacesState.items.length > 0 ? (
                  <p className="text-muted small py-2 mb-0 text-center">Loading more…</p>
                ) : null}
              </div>
            )}

            {activeTab === "rewards" && (
              <div
                ref={rewardsScrollRef}
                className="member-profile-tab-scroll"
                onScroll={() =>
                  handleScrollLoad(rewardsScrollRef.current, rewardsState, loadRewards)
                }
              >
                {rewardsState.loading && rewardsState.items.length === 0 ? (
                  <p className="text-muted small py-3 mb-0">Loading rewards…</p>
                ) : rewardsState.items.length === 0 ? (
                  <p className="text-muted small py-3 mb-0">No Wall of Wins entries yet.</p>
                ) : (
                  <ul className="member-profile-activity-list list-unstyled mb-0">
                    {rewardsState.items.map((row) => (
                      <li key={row.id} className="member-profile-activity-row member-profile-activity-row--reward">
                        {row.image_url ? (
                          <img
                            src={resolvePublicMediaUrl(row.image_url, apiBaseUrl)}
                            alt=""
                            className="member-profile-reward-thumb"
                          />
                        ) : null}
                        <div className="member-profile-reward-copy">
                          <div className="member-profile-activity-row-title">
                            {row.title || "Wall of Win"}
                          </div>
                          <div className="member-profile-activity-row-meta">
                            <span>{formatShortDateTime(row.created_at)}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {rewardsState.loading && rewardsState.items.length > 0 ? (
                  <p className="text-muted small py-2 mb-0 text-center">Loading more…</p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
