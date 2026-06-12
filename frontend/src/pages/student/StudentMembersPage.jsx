import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  FiChevronDown,
  FiMapPin,
  FiMessageCircle,
  FiMoreHorizontal,
  FiNavigation,
  FiUserPlus,
} from "react-icons/fi";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";
import StudentPageSearchSync from "../../components/StudentPageSearchSync";
import MemberProfileModal from "../../components/MemberProfileModal";
import { MemberDirectoryGridSkeleton } from "../../components/skeletons/LoadingSkeletons";

const PAGE_SIZE = 24;
const SCROLL_LOAD_THRESHOLD_PX = 120;
const SEARCH_DEBOUNCE_MS = 400;

const displayRoleLabel = (role) => {
  const r = String(role ?? "").trim();
  if (!r) return "Member";
  if (r.toLowerCase() === "student") return "Member";
  return r;
};

const cardAccentClass = (id) => {
  const n = Number(id) || 0;
  const i = Math.abs(n) % 5;
  return ["member-directory-card--accent-0", "member-directory-card--accent-1", "member-directory-card--accent-2", "member-directory-card--accent-3", "member-directory-card--accent-4"][i];
};

const initialsFromName = (name, email) => {
  const n = String(name || "").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (parts.length === 1) return parts[0].toUpperCase();
  const e = String(email || "").trim();
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  return "?";
};

export default function StudentMembersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightMemberId = Number(searchParams.get("member") || "0");
  const [members, setMembers] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [listLoadingMore, setListLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortKey, setSortKey] = useState("latest");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [directoryProfileUser, setDirectoryProfileUser] = useState(null);
  const navigate = useNavigate();
  const [hasMore, setHasMore] = useState(true);
  const sortWrapRef = useRef(null);
  const headerMoreRef = useRef(null);
  const scrollRef = useRef(null);
  const nextOffsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const fetchInFlightRef = useRef(false);

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q != null) setSearchTerm(q);
  }, [searchParams]);

  const fetchMembersPage = useCallback(
    async (append) => {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Session missing. Please login first.");
        return;
      }
      if (fetchInFlightRef.current) return;
      if (append && !hasMoreRef.current) return;

      const offset = append ? nextOffsetRef.current : 0;
      fetchInFlightRef.current = true;
      if (append) setListLoadingMore(true);
      else {
        setListLoading(true);
        setMembers([]);
        setTotalCount(null);
      }
      setError("");

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
          sort: sortKey === "name" ? "name" : "latest",
        });
        if (debouncedSearch) params.set("q", debouncedSearch);
        const response = await fetch(`${apiBaseUrl}/api/users/members?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Unable to fetch members.");
        }
        const rows = Array.isArray(payload.data) ? payload.data : [];
        const pagination = payload.pagination || {};
        const hasMore = Boolean(pagination.has_more);
        const nextOff = Number(pagination.next_offset ?? offset + rows.length);
        const total = pagination.total != null ? Number(pagination.total) : null;

        hasMoreRef.current = hasMore;
        nextOffsetRef.current = nextOff;
        setHasMore(hasMore);
        if (total != null && !Number.isNaN(total)) setTotalCount(total);

        setMembers((prev) => {
          if (!append) return rows;
          const seen = new Set(prev.map((m) => Number(m.id)));
          const merged = [...prev];
          for (const row of rows) {
            const id = Number(row.id);
            if (!seen.has(id)) {
              seen.add(id);
              merged.push(row);
            }
          }
          return merged;
        });
      } catch (fetchError) {
        setError(fetchError.message || "Unable to fetch members.");
        if (!append) {
          setMembers([]);
          setTotalCount(null);
          hasMoreRef.current = false;
          nextOffsetRef.current = 0;
          setHasMore(false);
        }
      } finally {
        fetchInFlightRef.current = false;
        setListLoading(false);
        setListLoadingMore(false);
      }
    },
    [apiBaseUrl, debouncedSearch, sortKey],
  );

  useEffect(() => {
    nextOffsetRef.current = 0;
    hasMoreRef.current = true;
    setHasMore(true);
    fetchMembersPage(false);
  }, [debouncedSearch, sortKey, fetchMembersPage]);

  useEffect(() => {
    if (!Number.isFinite(highlightMemberId) || highlightMemberId <= 0 || members.length === 0) {
      return undefined;
    }
    const t = window.setTimeout(() => {
      document
        .getElementById(`member-directory-card-${highlightMemberId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [highlightMemberId, members.length]);

  useEffect(() => {
    if (!sortMenuOpen && !headerMenuOpen) return undefined;
    const close = (e) => {
      if (sortMenuOpen && !sortWrapRef.current?.contains(e.target)) setSortMenuOpen(false);
      if (headerMenuOpen && !headerMoreRef.current?.contains(e.target)) setHeaderMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [sortMenuOpen, headerMenuOpen]);

  const handleDirectoryScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || listLoading || listLoadingMore || !hasMore || fetchInFlightRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - SCROLL_LOAD_THRESHOLD_PX) {
      fetchMembersPage(true);
    }
  }, [fetchMembersPage, listLoading, listLoadingMore, hasMore]);

  const visibleMembers = useMemo(() => {
    const loc = locationFilter.trim().toLowerCase();
    return members.filter((member) => {
      if (tagFilter === "member") {
        if (String(member.role || "").toLowerCase() !== "student") return false;
      }
      if (loc) {
        const city = String(member.city || member.location || "").toLowerCase();
        if (!city.includes(loc)) return false;
      }
      return true;
    });
  }, [members, locationFilter, tagFilter]);

  const sortedMembers = useMemo(() => {
    const list = [...visibleMembers];
    if (sortKey === "name") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
      return list;
    }
    list.sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });
    return list;
  }, [visibleMembers, sortKey]);

  const sortLabel = sortKey === "name" ? "Name" : "Latest";

  const subtitleForMember = (member) => {
    const role = displayRoleLabel(member.role);
    return `${role} · Sell It Community`;
  };

  const locationLine = (member) => {
    const loc = String(member.city || member.location || "").trim();
    return loc || "—";
  };

  const countLabel =
    totalCount != null && !Number.isNaN(totalCount)
      ? sortedMembers.length === members.length
        ? String(totalCount)
        : `${sortedMembers.length} / ${totalCount}`
      : String(sortedMembers.length);

  return (
    <StudentDashboardSectionPage title="Member Directory">
      <StudentPageSearchSync onSearchChange={setSearchTerm} />
      <div className="member-directory-wrap">
        <section className="member-directory-page lms-card">
          <header className="member-directory-header">
            <h1 className="member-directory-title">Member Directory</h1>
            <div className="member-directory-header-actions">
              <div className="member-directory-sort" ref={sortWrapRef}>
                <button
                  type="button"
                  className="member-directory-sort-trigger"
                  aria-expanded={sortMenuOpen}
                  onClick={() => setSortMenuOpen((o) => !o)}
                >
                  {sortLabel}
                  <FiChevronDown aria-hidden />
                </button>
                {sortMenuOpen ? (
                  <div className="member-directory-sort-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className={sortKey === "latest" ? "is-active" : ""}
                      onClick={() => {
                        setSortKey("latest");
                        setSortMenuOpen(false);
                      }}
                    >
                      Latest
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={sortKey === "name" ? "is-active" : ""}
                      onClick={() => {
                        setSortKey("name");
                        setSortMenuOpen(false);
                      }}
                    >
                      Name (A–Z)
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="member-directory-header-more-wrap" ref={headerMoreRef}>
                <button
                  type="button"
                  className="member-directory-icon-btn"
                  aria-label="More options"
                  aria-expanded={headerMenuOpen}
                  onClick={() => setHeaderMenuOpen((o) => !o)}
                >
                  <FiMoreHorizontal />
                </button>
                {headerMenuOpen ? (
                  <div className="member-directory-header-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        nextOffsetRef.current = 0;
                        hasMoreRef.current = true;
                        setHasMore(true);
                        fetchMembersPage(false);
                      }}
                    >
                      Reload from server
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="member-directory-body">
            <aside className="member-directory-sidebar">
              <div className="member-directory-filter-card">
                <div className="member-directory-filter-head">
                  <h2 className="member-directory-filter-title">Find members</h2>
                  <button
                    type="button"
                    className="member-directory-clear"
                    onClick={() => {
                      setSearchTerm("");
                      setDebouncedSearch("");
                      setLocationFilter("");
                      setTagFilter("");
                      const next = new URLSearchParams(searchParams);
                      next.delete("q");
                      setSearchParams(next, { replace: true });
                    }}
                  >
                    Clear all
                  </button>
                </div>
                <label className="member-directory-label" htmlFor="member-dir-search">
                  Search
                </label>
                <input
                  id="member-dir-search"
                  className="member-directory-input"
                  placeholder="Search name or email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
               
                <label className="member-directory-label" htmlFor="member-dir-location">
                  Location
                </label>
                <input
                  id="member-dir-location"
                  className="member-directory-input"
                  placeholder="Location"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                />
                <label className="member-directory-label" htmlFor="member-dir-tag">
                  Tag
                </label>
                <select
                  id="member-dir-tag"
                  className="member-directory-select"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                >
                  <option value="">Select an option</option>
                  <option value="member">Member</option>
                </select>
              </div>
            </aside>

            <div className="member-directory-main">
              {error ? <div className="member-directory-alert">{error}</div> : null}
              <div className="member-directory-main-head">
                <h2 className="member-directory-section-title">All members</h2>
                <span className="member-directory-count">{countLabel}</span>
              </div>
              <div
                ref={scrollRef}
                className="member-directory-scroll"
                onScroll={handleDirectoryScroll}
              >
                {listLoading && members.length === 0 ? (
                  <MemberDirectoryGridSkeleton count={8} />
                ) : sortedMembers.length === 0 ? (
                  <p className="member-directory-empty">No members match your filters.</p>
                ) : (
                  <div className="member-directory-grid">
                    {sortedMembers.map((member) => (
                      <article
                        key={member.id}
                        id={`member-directory-card-${member.id}`}
                        className={`member-directory-card ${cardAccentClass(member.id)} ${
                          Number(member.id) === highlightMemberId ? "is-highlighted" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="member-directory-card-hit"
                          onClick={() => setDirectoryProfileUser(member)}
                        >
                          <div className="member-directory-card-avatar" aria-hidden>
                            {initialsFromName(member.name, member.email)}
                          </div>
                          <h3 className="member-directory-card-name">{member.name || "Member"}</h3>
                          <p className="member-directory-card-bio">{subtitleForMember(member)}</p>
                          <p className="member-directory-card-location">
                            <FiMapPin aria-hidden />
                            <span>{locationLine(member)}</span>
                          </p>
                        </button>
                        <button
                          type="button"
                          className="member-directory-card-message"
                          onClick={() => navigate(`/dashboard/student-messages?memberId=${member.id}`)}
                        >
                          <FiMessageCircle aria-hidden />
                          Message
                        </button>
                      </article>
                    ))}
                  </div>
                )}
                {listLoadingMore ? (
                  <p className="member-directory-load-more" role="status">
                    Loading more…
                  </p>
                ) : null}
                {!listLoading && members.length > 0 && !hasMore && sortedMembers.length > 0 ? (
                  <p className="member-directory-end-hint">End of list</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <Link to="/dashboard/student-messages" className="member-directory-fab" aria-label="Open messages">
          <FiMessageCircle />
        </Link>
      </div>

      <MemberProfileModal
        open={Boolean(directoryProfileUser)}
        summaryMember={directoryProfileUser}
        onClose={() => setDirectoryProfileUser(null)}
        apiBaseUrl={apiBaseUrl}
        messagesPath="/dashboard/student-messages"
        showMessageButton
        profileCopyPathname="/dashboard/student-members"
        profileCopyQueryParam="member"
      />
    </StudentDashboardSectionPage>
  );
}
