import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StudentDashboardSectionPage from "../student/StudentDashboardSectionPage";
import DashboardSectionPage from "./DashboardSectionPage";

export default function WallOfWinsDetailPage({
  SectionComponent = StudentDashboardSectionPage,
  backPath = "/dashboard/student-wall-of-wins",
  detailBasePath = "/dashboard/student-wall-of-wins",
}) {
  const DashboardSection = SectionComponent;
  const { entryId } = useParams();
  const [entry, setEntry] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [hasMoreSuggestions, setHasMoreSuggestions] = useState(true);
  const [error, setError] = useState("");
  const suggestionsRef = useRef({ limit: 8, offset: 0 });
  const suggestionsBoxRef = useRef(null);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || "http://localhost:5003").replace(/\/$/, ""),
    [],
  );

  const fetchEntry = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/wall-of-wins/${entryId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to load Wall of Wins entry.");
      }
      setEntry(payload.data || null);
    } catch (e) {
      setEntry(null);
      setError(e.message || "Unable to load Wall of Wins entry.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, entryId]);

  const fetchSuggestions = useCallback(
    async (reset = false) => {
      const token = localStorage.getItem("token");
      if (!token) return;
      const limit = suggestionsRef.current.limit;
      const offset = reset ? 0 : suggestionsRef.current.offset;
      if (!reset && !hasMoreSuggestions) return;
      try {
        setSuggestionsLoading(true);
        const response = await fetch(
          `${apiBaseUrl}/api/wall-of-wins/${entryId}/suggestions?limit=${limit}&offset=${offset}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = await response.json();
        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Unable to load suggestions.");
        }
        const rows = Array.isArray(payload.data) ? payload.data : [];
        setSuggestions((prev) => (reset ? rows : [...prev, ...rows]));
        suggestionsRef.current.offset = offset + rows.length;
        setHasMoreSuggestions(Boolean(payload?.pagination?.has_more));
      } catch {
        setHasMoreSuggestions(false);
      } finally {
        setSuggestionsLoading(false);
      }
    },
    [apiBaseUrl, entryId, hasMoreSuggestions],
  );

  useEffect(() => {
    suggestionsRef.current.offset = 0;
    setSuggestions([]);
    setHasMoreSuggestions(true);
  }, [entryId]);

  useEffect(() => {
    const id = window.setTimeout(fetchEntry, 0);
    return () => window.clearTimeout(id);
  }, [fetchEntry]);

  useEffect(() => {
    const id = window.setTimeout(() => fetchSuggestions(true), 0);
    return () => window.clearTimeout(id);
  }, [fetchSuggestions]);

  const onSuggestionsScroll = () => {
    const el = suggestionsBoxRef.current;
    if (!el || suggestionsLoading || !hasMoreSuggestions) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      fetchSuggestions(false);
    }
  };

  return (
    <DashboardSection title="Wall of Wins Detail">
      <div className="container-fluid px-0 sell-snack-detail-page" style={{ maxWidth: 1200 }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Link to={backPath} className="btn btn-outline-secondary btn-sm">
            Back to Wall of Wins
          </Link>
        </div>
        {error && <div className="alert alert-danger mb-3">{error}</div>}
        {isLoading && !entry ? (
          <div className="lms-card p-4 text-muted">Loading entry...</div>
        ) : !entry ? (
          <div className="lms-card p-4 text-muted">Entry not found.</div>
        ) : (
          <div className="row g-3">
            <div className="col-xl-8">
              <div className="lms-card overflow-hidden">
                <div className="position-relative bg-dark">
                  <img
                    src={entry.image_url}
                    alt={entry.title || "Wall of Wins image"}
                    style={{ width: "100%", maxHeight: 560, objectFit: "contain", display: "block" }}
                  />
                </div>
                <div className="px-4 py-3 border-top student-interaction-panel">
                  <h2 className="h5 fw-bold mb-1">{entry.title || "Untitled win"}</h2>
                  <p className="mb-0 text-muted small">
                    by {entry.user_name || "Member"} •{" "}
                    {entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}
                  </p>
                </div>
              </div>
            </div>
            <div className="col-xl-4">
              <div className="lms-card p-4 sell-snack-suggested-sidebar">
                <h2 className="h6 fw-bold mb-3 text-uppercase text-muted small">Next suggested</h2>
                <div
                  ref={suggestionsBoxRef}
                  className="sell-snack-suggested-scroll"
                  onScroll={onSuggestionsScroll}
                >
                  {suggestions.length === 0 && !suggestionsLoading ? (
                    <p className="text-muted small mb-0">No more entries.</p>
                  ) : (
                    <ul className="list-unstyled mb-0 sell-snack-suggested-list">
                      {suggestions.map((item) => (
                        <li key={item.id} className="mb-3">
                          <Link
                            to={`${detailBasePath}/${item.id}`}
                            className="text-decoration-none text-reset d-flex gap-3 sell-snack-suggested-row"
                          >
                            <div
                              className="rounded sell-snack-suggested-thumb"
                              style={{
                                background: item.image_url
                                  ? `url(${item.image_url}) center/cover no-repeat`
                                  : "linear-gradient(135deg,#e2e8f0,#f8fafc)",
                              }}
                            />
                            <div>
                              <p className="fw-semibold mb-1 small sell-snack-suggested-title">
                                {item.title || "Untitled win"}
                              </p>
                              <p className="mb-0 small text-muted">{item.user_name || "Member"}</p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {suggestionsLoading && (
                    <p className="text-muted small mb-0 mt-2">
                      {suggestions.length ? "Loading more…" : "Loading suggestions…"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardSection>
  );
}

export function AdminWallOfWinsDetailPage() {
  return (
    <WallOfWinsDetailPage
      SectionComponent={DashboardSectionPage}
      backPath="/dashboard/feed-management/wall-of-wins"
      detailBasePath="/dashboard/feed-management/wall-of-wins"
    />
  );
}

