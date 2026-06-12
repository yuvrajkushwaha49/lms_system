import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { useNavigate } from "react-router-dom";
import DashboardSectionPage from "./DashboardSectionPage";
import { AskRyanAdminListSkeleton } from "../../components/skeletons/LoadingSkeletons";

export default function AdminAskRyanManagementPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("pending");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [responseTitle, setResponseTitle] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [thumbFile, setThumbFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/ask-ryan/admin/questions?status=${encodeURIComponent(filter)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to load questions.");
      }
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (e) {
      setError(e.message || "Unable to load.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, filter, navigate]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const selected = rows.find((r) => String(r.id) === String(selectedId));

  const submitAnswer = async (e) => {
    e.preventDefault();
    if (!selected || selected.status !== "pending") return;
    const token = localStorage.getItem("token");
    if (!token || !responseTitle.trim()) {
      setError("Title is required.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      setNotice("");
      const fd = new FormData();
      if (videoFile) fd.append("video", videoFile);
      if (thumbFile) fd.append("thumbnail", thumbFile);
      fd.append("response_title", responseTitle.trim());
      const response = await fetch(`${apiBaseUrl}/api/ask-ryan/admin/questions/${selected.id}/answer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to publish answer.");
      }
      setNotice("Reply saved. Students will see it on Ask Ryan Anything.");
      setVideoFile(null);
      setThumbFile(null);
      setResponseTitle("");
      setSelectedId(null);
      await load();
    } catch (err) {
      setError(err.message || "Unable to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardSectionPage title="Ask Ryan Anything">
      <div className="container-fluid px-0" style={{ maxWidth: 1100 }}>
        <div className="lms-card p-4 mb-3">
          <h1 className="h5 mb-2" style={{ fontWeight: 600 }}>
            Reply to member questions
          </h1>
                  <p className="text-muted mb-0 small">
            Open a pending question, add a short title for the card, and optionally upload a reply file (video) with an optional
            thumbnail. Answered threads appear on the student Ask Ryan page.
          </p>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}
        {notice && <div className="alert alert-success py-2">{notice}</div>}

        <div className="row g-3">
          <div className="col-lg-5">
            <div className="lms-card p-3">
              <div className="d-flex flex-wrap gap-2 mb-3">
                {["pending", "answered", "all"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`btn btn-sm ${filter === key ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => {
                      setFilter(key);
                      setSelectedId(null);
                    }}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
                <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" onClick={() => void load()}>
                  Refresh
                </button>
              </div>
              {loading ? (
                <AskRyanAdminListSkeleton count={6} />
              ) : rows.length === 0 ? (
                <p className="text-muted small mb-0">No questions in this filter.</p>
              ) : (
                <ul className="list-group list-group-flush ask-ryan-admin-list">
                  {rows.map((r) => (
                    <li key={r.id} className="list-group-item px-0">
                      <button
                        type="button"
                        className={`btn btn-link text-start p-0 text-decoration-none w-100 ask-ryan-admin-row${String(selectedId) === String(r.id) ? " ask-ryan-admin-row--active" : ""}`}
                        onClick={() => {
                          setSelectedId(r.id);
                          setResponseTitle(r.response_title || "");
                          setVideoFile(null);
                          setThumbFile(null);
                        }}
                      >
                        <span className="badge bg-secondary me-2">{r.status}</span>
                        <span className="small text-muted">{r.user_name || "Member"} — </span>
                        {r.question_text.slice(0, 120)}
                        {r.question_text.length > 120 ? "…" : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="col-lg-7">
            <div className="lms-card p-4">
              {!selected ? (
                <p className="text-muted small mb-0">Select a question on the left to post a video reply.</p>
              ) : selected.status === "answered" ? (
                <div>
                  <p className="small text-success mb-2">Already answered.</p>
                  <p className="small mb-1">
                    <strong>Title:</strong> {selected.response_title}
                  </p>
                  {selected.response_video_url && (
                    <video
                      className="w-100 rounded"
                      style={{ maxHeight: 320 }}
                      controls
                      src={selected.response_video_url}
                      poster={selected.response_thumbnail_url || undefined}
                    />
                  )}
                </div>
              ) : (
                <form onSubmit={submitAnswer}>
                  <p className="small text-muted mb-3">{selected.question_text}</p>
                  <div className="mb-3">
                    <label className="form-label small" htmlFor="ar-title">
                      Card title (shown on the grid)
                    </label>
                    <input
                      id="ar-title"
                      className="form-control"
                      value={responseTitle}
                      onChange={(e) => setResponseTitle(e.target.value)}
                      placeholder="e.g. Staying optimistic as an agent"
                      maxLength={500}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small" htmlFor="ar-video">
                      Reply file (optional)
                    </label>
                    <input
                      id="ar-video"
                      type="file"
                      accept="video/*"
                      className="form-control"
                      onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small" htmlFor="ar-thumb">
                      Thumbnail (optional)
                    </label>
                    <input
                      id="ar-thumb"
                      type="file"
                      accept="image/*"
                      className="form-control"
                      onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? "Saving…" : "Save reply"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardSectionPage>
  );
}
