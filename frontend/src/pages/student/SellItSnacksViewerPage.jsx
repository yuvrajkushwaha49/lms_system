import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";
import { SNACK_CATEGORIES } from "../../constants/snackCategories";

export default function SellItSnacksViewerPage({
  SectionComponent = StudentDashboardSectionPage,
  detailBasePath = "/dashboard/student-sell-it-snacks",
}) {
  const SORT_OPTIONS = [
    "Latest",
    "New activity",
    "Oldest",
    "Popular",
    "Likes",
    "Alphabetical",
  ];
  const DashboardSection = SectionComponent;
  const navigate = useNavigate();
  const [snacks, setSnacks] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeSort, setActiveSort] = useState("Popular");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const sortMenuRef = useRef(null);

  const apiBaseUrl = useMemo(
    () =>
      (import.meta.env.VITE_API_BASE_URL || "http://localhost:5003").replace(
        /\/$/,
        "",
      ),
    [],
  );

  const fetchSnacks = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      return;
    }
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/snacks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to fetch Sell It Snacks.");
      }
      setSnacks(Array.isArray(payload.data) ? payload.data : []);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to fetch Sell It Snacks.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchSnacks, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchSnacks]);

  const visibleSnacks = useMemo(() => {
    if (activeCategory === "All") return snacks;
    return snacks.filter((snack) => snack.category === activeCategory);
  }, [activeCategory, snacks]);

  const sortedSnacks = useMemo(() => {
    const items = [...visibleSnacks];
    const toNumber = (value) => Number(value || 0);
    const fallbackId = (value) => Number(value?.id || 0);
    const getDate = (value) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const getCreatedAt = (item) => getDate(item.created_at || item.createdAt || item.created_on);
    const getUpdatedAt = (item) =>
      getDate(item.updated_at || item.updatedAt || item.last_activity_at || item.lastActivityAt) ||
      getCreatedAt(item);

    if (activeSort === "Latest") {
      return items.sort((a, b) => getCreatedAt(b) - getCreatedAt(a) || fallbackId(b) - fallbackId(a));
    }
    if (activeSort === "New activity") {
      return items.sort((a, b) => getUpdatedAt(b) - getUpdatedAt(a) || fallbackId(b) - fallbackId(a));
    }
    if (activeSort === "Oldest") {
      return items.sort((a, b) => getCreatedAt(a) - getCreatedAt(b) || fallbackId(a) - fallbackId(b));
    }
    if (activeSort === "Popular") {
      return items.sort(
        (a, b) =>
          toNumber(b.likes_count || b.likesCount) +
          toNumber(b.comments_count || b.commentsCount) -
          (toNumber(a.likes_count || a.likesCount) + toNumber(a.comments_count || a.commentsCount)),
      );
    }
    if (activeSort === "Likes") {
      return items.sort(
        (a, b) =>
          toNumber(b.likes_count || b.likesCount) - toNumber(a.likes_count || a.likesCount) ||
          fallbackId(b) - fallbackId(a),
      );
    }
    if (activeSort === "Alphabetical") {
      return items.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    }
    return items;
  }, [activeSort, visibleSnacks]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!sortMenuRef.current?.contains(event.target)) {
        setIsSortMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const openSnack = (snack) => {
    navigate(`${detailBasePath}/${snack.id}`);
  };

  return (
    <DashboardSection title="Sell It Snacks">
      <div className="sell-snacks-page">
        <div className="sell-snacks-head">
          <div className="d-flex align-items-center gap-2">
            <span aria-hidden="true">🍿</span>
            <h1>Sell It Snacks</h1>
          </div>
          <div className="sell-snacks-head-actions">
            <div className="sell-snacks-sort-wrap" ref={sortMenuRef}>
              <button
                type="button"
                className="sell-snacks-sort-btn"
                onClick={() => setIsSortMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isSortMenuOpen}
              >
                {activeSort}
                <i className="bi bi-chevron-down sell-snacks-sort-caret" aria-hidden="true"></i>
              </button>
              {isSortMenuOpen && (
                <div className="sell-snacks-sort-menu" role="menu" aria-label="Sort snacks">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="menuitem"
                      className={`sell-snacks-sort-option ${activeSort === option ? "active" : ""}`}
                      onClick={() => {
                        setActiveSort(option);
                        setIsSortMenuOpen(false);
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
           
          </div>
        </div>

        <div className="sell-snacks-hero">
          <div>
            <h2>Your Inside Look At Membership</h2>
            <p>
              Join weekly to experience the insights and expertise from the
              community.
            </p>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="sell-snacks-tabs">
          {["All", ...SNACK_CATEGORIES].map((category) => (
            <button
              key={category}
              type="button"
              className={activeCategory === category ? "active" : ""}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="lms-card p-5 text-center text-muted">
            Loading Sell It Snacks...
          </div>
        ) : visibleSnacks.length === 0 ? (
          <div className="lms-card p-5 text-center text-muted">
            No videos in this section yet.
          </div>
        ) : (
          <div className="sell-snacks-grid">
            {sortedSnacks.map((snack) => (
              <button
                key={snack.id}
                type="button"
                className="sell-snack-card"
                onClick={() => openSnack(snack)}
              >
                <div
                  className="sell-snack-thumb"
                  style={{
                    background: snack.thumbnail_url
                      ? `url(${snack.thumbnail_url}) center/cover no-repeat`
                      : "linear-gradient(135deg,#4169ff,#f7efe1)",
                  }}
                >
                  {!snack.thumbnail_url && <span>{snack.category}</span>}
                </div>
                <div className="sell-snack-body">
                  <h3>{snack.title}</h3>
                  <div
                    className="sell-snack-stats"
                    aria-label="Snack engagement"
                  >
                    <small>
                      <i className="bi bi-hand-thumbs-up me-1"></i>
                      {Number(snack.likes_count || 0)} Like
                    </small>
                    <small className="ms-3">
                      <i className="bi bi-chat-dots me-1"></i>
                      {Number(snack.comments_count || 0)} Comment
                    </small>
                  </div>
                  {/* <p>{snack.description || "Watch this Sell It Snack."}</p> */}
                  {snack.processing_status === "processing" && (
                    <small className="text-primary fw-semibold">
                      Processing HD qualities...
                    </small>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

      </div>
    </DashboardSection>
  );
}

