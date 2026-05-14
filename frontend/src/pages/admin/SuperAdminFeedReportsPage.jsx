import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import DashboardSectionPage from "./DashboardSectionPage";

const formatReportDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const TABS = [
  { id: "posts", label: "Posts" },
  { id: "feed-comments", label: "Feed comments" },
  { id: "snack-comments", label: "Snack comments" },
  { id: "course-comments", label: "Course comments" },
];

export default function SuperAdminFeedReportsPage({
  pageTitle = "Feed Reports",
  heading = "Reports",
  intro = "Review community moderation: feed posts, comments on the feed, Sell It Snacks, and courses.",
  postingSpaceFilter = "",
} = {}) {
  const { pathname } = useLocation();
  const reportDetailBasePath = useMemo(() => {
    if (pathname.startsWith("/dashboard/admin-community/reports")) {
      return "/dashboard/admin-community/reports";
    }
    return "/dashboard/feed-management/reports";
  }, [pathname]);

  const visibleTabs = useMemo(() => {
    if (postingSpaceFilter) {
      return TABS.filter((tab) => tab.id === "posts" || tab.id === "feed-comments");
    }
    return TABS;
  }, [postingSpaceFilter]);

  const [activeTab, setActiveTab] = useState("posts");
  const [postReports, setPostReports] = useState([]);
  const [postSummary, setPostSummary] = useState({ pending: 0, reviewed: 0, resolved: 0, total: 0 });
  const [feedCommentReports, setFeedCommentReports] = useState([]);
  const [feedCommentSummary, setFeedCommentSummary] = useState({
    pending: 0,
    reviewed: 0,
    resolved: 0,
    total: 0,
  });
  const [snackCommentReports, setSnackCommentReports] = useState([]);
  const [snackCommentSummary, setSnackCommentSummary] = useState({
    pending: 0,
    reviewed: 0,
    resolved: 0,
    total: 0,
  });
  const [courseCommentReports, setCourseCommentReports] = useState([]);
  const [courseCommentSummary, setCourseCommentSummary] = useState({
    pending: 0,
    reviewed: 0,
    resolved: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || "http://localhost:5003").replace(/\/$/, ""),
    [],
  );

  const spaceQuery = postingSpaceFilter
    ? `?space=${encodeURIComponent(postingSpaceFilter)}`
    : "";

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id || "posts");
    }
  }, [visibleTabs, activeTab]);

  const currentSummary = useMemo(() => {
    if (activeTab === "posts") return postSummary;
    if (activeTab === "feed-comments") return feedCommentSummary;
    if (activeTab === "snack-comments") return snackCommentSummary;
    return courseCommentSummary;
  }, [
    activeTab,
    postSummary,
    feedCommentSummary,
    snackCommentSummary,
    courseCommentSummary,
  ]);

  const reportCards = useMemo(
    () => [
      { title: "Pending reports", value: currentSummary.pending, description: "Reports waiting for review." },
      { title: "Resolved reports", value: currentSummary.resolved, description: "Reports closed by admins." },
      { title: "Total reports", value: currentSummary.total, description: "All reports in this section." },
    ],
    [currentSummary],
  );

  const fetchTabData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      return;
    }
    try {
      setIsLoading(true);
      setError("");
      if (activeTab === "posts") {
        const response = await fetch(`${apiBaseUrl}/api/feed/reports${spaceQuery}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Unable to fetch feed reports.");
        }
        setPostReports(Array.isArray(payload.data) ? payload.data : []);
        setPostSummary(payload.summary || { pending: 0, reviewed: 0, resolved: 0, total: 0 });
        return;
      }
      if (activeTab === "feed-comments") {
        const response = await fetch(`${apiBaseUrl}/api/feed/reports/comments${spaceQuery}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Unable to fetch feed comment reports.");
        }
        setFeedCommentReports(Array.isArray(payload.data) ? payload.data : []);
        setFeedCommentSummary(payload.summary || { pending: 0, reviewed: 0, resolved: 0, total: 0 });
        return;
      }
      if (activeTab === "snack-comments") {
        const response = await fetch(`${apiBaseUrl}/api/snacks/comment-reports`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Unable to fetch snack comment reports.");
        }
        setSnackCommentReports(Array.isArray(payload.data) ? payload.data : []);
        setSnackCommentSummary(payload.summary || { pending: 0, reviewed: 0, resolved: 0, total: 0 });
        return;
      }
      const response = await fetch(`${apiBaseUrl}/api/courses/reports/video-comments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to fetch course comment reports.");
      }
      setCourseCommentReports(Array.isArray(payload.data) ? payload.data : []);
      setCourseCommentSummary(payload.summary || { pending: 0, reviewed: 0, resolved: 0, total: 0 });
    } catch (fetchError) {
      setError(fetchError.message || "Unable to fetch reports.");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, apiBaseUrl, postingSpaceFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchTabData, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchTabData]);

  const tableEmpty =
    activeTab === "posts"
      ? postReports.length === 0
      : activeTab === "feed-comments"
        ? feedCommentReports.length === 0
        : activeTab === "snack-comments"
          ? snackCommentReports.length === 0
          : courseCommentReports.length === 0;

  const sectionDescription =
    activeTab === "posts"
      ? postingSpaceFilter
        ? "Latest reports on Sell It Community feed posts only."
        : "Latest reports submitted on feed posts."
      : activeTab === "feed-comments"
        ? postingSpaceFilter
          ? "Reports on comments for Sell It Community posts only."
          : "Reports on community feed comments."
        : activeTab === "snack-comments"
          ? "Reports on Sell It Snacks comments."
          : "Reports on course video comments.";

  return (
    <DashboardSectionPage title={pageTitle}>
      <div className="container-fluid px-0" style={{ maxWidth: 1200 }}>
        <div className="lms-card p-4 p-md-5 mb-3">
          <h1 className="h3 fw-bold mb-2">{heading}</h1>
          <p className="text-muted mb-3">{intro}</p>
          <div className="d-flex flex-wrap gap-2" role="tablist" aria-label="Report sections">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`btn btn-sm ${activeTab === tab.id ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="row g-3">
          {reportCards.map((card) => (
            <div key={card.title} className="col-md-4">
              <div className="lms-card p-4 h-100">
                <p className="text-muted mb-1">{card.title}</p>
                <h2 className="fw-bold mb-2">{card.value}</h2>
                <p className="text-muted mb-0 small">{card.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="lms-card p-4 mt-3">
          <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
            <div>
              <h2 className="h5 fw-semibold mb-1">
                {visibleTabs.find((t) => t.id === activeTab)?.label || "Reports"}
              </h2>
              <p className="text-muted mb-0">{sectionDescription}</p>
            </div>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={fetchTabData} disabled={isLoading}>
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {isLoading && tableEmpty ? (
            <p className="text-muted mb-0">Loading reports...</p>
          ) : tableEmpty ? (
            <p className="text-muted mb-0">No reports in this section yet.</p>
          ) : activeTab === "posts" ? (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Post</th>
                    <th>Reported By</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {postReports.map((report) => (
                    <tr key={report.id}>
                      <td>
                        <div className="fw-semibold">{report.post_heading || "Untitled post"}</div>
                        <small className="text-muted">Posted by {report.post_user_name || "Member"}</small>
                      </td>
                      <td>{report.reporter_name || "Member"}</td>
                      <td>{report.reason}</td>
                      <td>
                        <span className={`badge ${report.post_is_blocked ? "text-bg-danger" : "text-bg-warning"}`}>
                          {report.post_is_blocked ? "blocked" : report.status || "pending"}
                        </span>
                      </td>
                      <td>{formatReportDate(report.created_at)}</td>
                      <td className="text-end">
                        <Link to={`${reportDetailBasePath}/${report.id}`} className="btn btn-sm btn-outline-primary">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : activeTab === "feed-comments" ? (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Post</th>
                    <th>Comment</th>
                    <th>Comment by</th>
                    <th>Reported By</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {feedCommentReports.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="fw-semibold">{row.post_heading || "—"}</div>
                        <small className="text-muted">Post by {row.post_user_name || "Member"}</small>
                      </td>
                      <td>
                        <span className="small">{row.comment_preview || "—"}</span>
                      </td>
                      <td>{row.comment_author_name || "—"}</td>
                      <td>{row.reporter_name || "Member"}</td>
                      <td>{row.reason}</td>
                      <td>
                        <span className="badge text-bg-warning">{row.status || "pending"}</span>
                      </td>
                      <td>{formatReportDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : activeTab === "snack-comments" ? (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Snack</th>
                    <th>Comment</th>
                    <th>Comment by</th>
                    <th>Reported By</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {snackCommentReports.map((row) => (
                    <tr key={row.id}>
                      <td className="fw-semibold">{row.snack_title || "—"}</td>
                      <td>
                        <span className="small">{row.comment_preview || "—"}</span>
                      </td>
                      <td>{row.comment_author_name || "—"}</td>
                      <td>{row.reporter_name || "Member"}</td>
                      <td>{row.reason}</td>
                      <td>
                        <span className="badge text-bg-warning">{row.status || "pending"}</span>
                      </td>
                      <td>{formatReportDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Video</th>
                    <th>Comment</th>
                    <th>Comment by</th>
                    <th>Reported By</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {courseCommentReports.map((row) => (
                    <tr key={row.id}>
                      <td className="fw-semibold">{row.course_title || "—"}</td>
                      <td>{row.video_title || "—"}</td>
                      <td>
                        <span className="small">{row.comment_preview || "—"}</span>
                      </td>
                      <td>{row.comment_author_name || "—"}</td>
                      <td>{row.reporter_name || "Member"}</td>
                      <td>{row.reason}</td>
                      <td>
                        <span className="badge text-bg-warning">{row.status || "pending"}</span>
                      </td>
                      <td>{formatReportDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardSectionPage>
  );
}

