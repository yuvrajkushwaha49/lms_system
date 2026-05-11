import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DashboardSectionPage from "./DashboardSectionPage";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const resolveReportVideoUrl = (attachment) => {
  const variants = Array.isArray(attachment?.video_variants) ? attachment.video_variants : [];
  const readyVariants = variants.filter((variant) => variant.status === "ready" && variant.media_url);
  const preferredVariant =
    readyVariants.find((variant) => variant.resolution === "720p") ||
    readyVariants.find((variant) => variant.resolution === "1080p") ||
    readyVariants.find((variant) => variant.resolution === "360p");
  return preferredVariant?.media_url || attachment?.media_url || "";
};

const renderPostAttachment = (attachment) => {
  const mediaType = String(attachment.media_type || "").toLowerCase();
  if (mediaType === "image") {
    return (
      <img
        src={attachment.media_url}
        alt={attachment.media_name || "Post attachment"}
        className="img-fluid rounded border"
        style={{ maxHeight: 420, width: "100%", objectFit: "contain", background: "#f8fafc" }}
      />
    );
  }
  if (mediaType === "video") {
    return (
      <video
        src={resolveReportVideoUrl(attachment)}
        className="w-100 rounded border bg-dark"
        style={{ maxHeight: 420 }}
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
      />
    );
  }
  return (
    <a href={attachment.media_url} target="_blank" rel="noreferrer" className="btn btn-outline-primary btn-sm">
      Open {attachment.media_name || "attachment"}
    </a>
  );
};

export default function SuperAdminFeedReportDetailPage() {
  const { reportId } = useParams();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || "http://localhost:5003").replace(/\/$/, ""),
    [],
  );

  const fetchReport = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      return;
    }
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/feed/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to fetch report detail.");
      }
      setReport(payload.data || null);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to fetch report detail.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, reportId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchReport, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchReport]);

  const handleBlockPost = async () => {
    if (!report?.id || report.post_is_blocked) return;
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      return;
    }
    try {
      setIsBlocking(true);
      setError("");
      setNotice("");
      const response = await fetch(`${apiBaseUrl}/api/feed/reports/${report.id}/block-post`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to block post.");
      }
      setNotice("Post blocked successfully. It will no longer appear in the feed.");
      await fetchReport();
    } catch (blockError) {
      setError(blockError.message || "Unable to block post.");
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <DashboardSectionPage title="Report Detail">
      <div className="container-fluid px-0" style={{ maxWidth: 1100 }}>
        <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
          <div>
            <h1 className="h3 fw-bold mb-1">Report Detail</h1>
            <p className="text-muted mb-0">Review the reported post and take moderation action.</p>
          </div>
          <Link to="/dashboard/feed-management/reports" className="btn btn-outline-secondary btn-sm">
            Back to reports
          </Link>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}
        {notice && <div className="alert alert-success py-2">{notice}</div>}

        {isLoading && !report ? (
          <div className="lms-card p-4">Loading report detail...</div>
        ) : report ? (
          <div className="row g-3">
            <div className="col-lg-8">
              <div className="lms-card p-4 h-100">
                <div className="d-flex justify-content-between gap-3 align-items-start mb-3">
                  <div>
                    <p className="text-muted mb-1">Reported post</p>
                    <h2 className="h4 fw-bold mb-1">{report.post_heading || "Untitled post"}</h2>
                    <p className="text-muted mb-0">
                      Posted by {report.post_user_name || "Member"} on {formatDateTime(report.post_created_at)}
                    </p>
                  </div>
                  <span className={`badge ${report.post_is_blocked ? "text-bg-danger" : "text-bg-success"}`}>
                    {report.post_is_blocked ? "Blocked" : "Visible"}
                  </span>
                </div>

                {report.post_sub_heading && <p className="fw-semibold">{report.post_sub_heading}</p>}
                <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                  {report.post_content || "No post content."}
                </p>

                {Array.isArray(report.post_attachments) && report.post_attachments.length > 0 && (
                  <div className="mt-4">
                    <h3 className="h6 fw-bold mb-3">Post files</h3>
                    <div className="d-flex flex-column gap-3">
                      {report.post_attachments.map((attachment) => (
                        <div key={attachment.id} className="p-3 rounded border bg-light">
                          <div className="d-flex justify-content-between gap-3 mb-2">
                            <strong>{attachment.media_name || "Attachment"}</strong>
                            <span className="badge text-bg-secondary">{attachment.media_type || "file"}</span>
                          </div>
                          {renderPostAttachment(attachment)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="col-lg-4">
              <div className="lms-card p-4 mb-3">
                <p className="text-muted mb-1">Report reason</p>
                <h3 className="h5 fw-bold">{report.reason}</h3>
                <div className="small text-muted">
                  Reported by {report.reporter_name || "Member"} on {formatDateTime(report.created_at)}
                </div>
                <hr />
                <p className="mb-1">
                  Status: <span className="badge text-bg-warning">{report.status || "pending"}</span>
                </p>
                {report.post_blocked_at && (
                  <p className="text-muted small mb-0">Blocked on {formatDateTime(report.post_blocked_at)}</p>
                )}
              </div>

              <div className="lms-card p-4">
                <h3 className="h5 fw-bold mb-2">Moderation action</h3>
                <p className="text-muted small">
                  Blocking hides this post from community feed pages for students, trainers, and admins.
                </p>
                <button
                  type="button"
                  className="btn btn-danger w-100"
                  onClick={handleBlockPost}
                  disabled={isBlocking || report.post_is_blocked}
                >
                  {report.post_is_blocked ? "Post already blocked" : isBlocking ? "Blocking..." : "Block post"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="lms-card p-4">Report not found.</div>
        )}
      </div>
    </DashboardSectionPage>
  );
}

