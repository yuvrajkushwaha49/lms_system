import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import DashboardSectionPage from "./DashboardSectionPage";
import { SNACK_CATEGORIES } from "../../constants/snackCategories";

const initialForm = {
  category: SNACK_CATEGORIES[0],
  title: "",
  description: "",
  video: null,
  thumbnail: null,
};

export default function AdminSellItSnacksPage() {
  const [snacks, setSnacks] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    visible: false,
    percent: 0,
    title: "",
    stage: "",
    error: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
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
      const response = await fetch(`${apiBaseUrl}/api/snacks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to fetch snacks.");
      }
      setSnacks(Array.isArray(payload.data) ? payload.data : []);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to fetch snacks.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchSnacks, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchSnacks]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;
    if (!form.title.trim() || !form.video) {
      setError("Title and video are required.");
      return;
    }
    try {
      setIsSubmitting(true);
      setError("");
      setNotice("");
      setUploadProgress({
        visible: true,
        percent: 10,
        title: form.title.trim(),
        stage: "Preparing upload...",
        error: "",
      });
      const formData = new FormData();
      formData.append("category", form.category);
      formData.append("title", form.title.trim());
      formData.append("description", form.description.trim());
      formData.append("video", form.video);
      if (form.thumbnail) formData.append("thumbnail", form.thumbnail);
      setUploadProgress((prev) => ({ ...prev, percent: 35, stage: "Uploading video file..." }));
      const response = await fetch(`${apiBaseUrl}/api/snacks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      setUploadProgress((prev) => ({ ...prev, percent: 85, stage: "Saving video details..." }));
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to upload snack.");
      }
      setNotice("Sell It Snack uploaded successfully.");
      setForm(initialForm);
      setShowUploadModal(false);
      setUploadProgress((prev) => ({ ...prev, percent: 100, stage: "Upload complete." }));
      await fetchSnacks();
      window.setTimeout(() => setUploadProgress((prev) => ({ ...prev, visible: false })), 1000);
    } catch (submitError) {
      setUploadProgress((prev) => ({
        ...prev,
        stage: "Upload failed",
        error: submitError.message || "Unable to upload snack.",
      }));
      setError(submitError.message || "Unable to upload snack.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardSectionPage title="Sell It Snacks">
      <div className="container-fluid px-0" style={{ maxWidth: 1200 }}>
        <div className="lms-card p-4 p-md-5 mb-3">
          <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
            <div>
              <h1 className="h3 fw-bold mb-1">Sell It Snacks</h1>
              <p className="text-muted mb-0">Upload videos into one of the Sell It Snacks sections.</p>
            </div>
            <button type="button" className="btn btn-primary rounded-pill px-4" onClick={() => setShowUploadModal(true)}>
              Upload Video
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}
        {notice && <div className="alert alert-success py-2">{notice}</div>}

        {uploadProgress.visible && (
          <div className="lms-card p-3 mb-3">
            <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
              <div>
                <p className="fw-semibold mb-0">{uploadProgress.title || "Uploading video"}</p>
                <small className={uploadProgress.error ? "text-danger" : "text-muted"}>
                  {uploadProgress.error || uploadProgress.stage}
                </small>
              </div>
              <span className="fw-semibold text-primary">{uploadProgress.percent}%</span>
            </div>
            <div className="progress" style={{ height: 8 }}>
              <div className={`progress-bar ${uploadProgress.error ? "bg-danger" : ""}`} style={{ width: `${uploadProgress.percent}%` }} />
            </div>
          </div>
        )}

        <div className="lms-card p-4">
          <h2 className="h5 fw-semibold mb-3">Uploaded videos</h2>
          {isLoading ? (
            <p className="text-muted mb-0">Loading...</p>
          ) : snacks.length === 0 ? (
            <p className="text-muted mb-0">No snacks uploaded yet.</p>
          ) : (
            <div className="row g-3">
              {snacks.map((snack) => (
                <div key={snack.id} className="col-md-6 col-xl-4">
                  <div className="border rounded-4 p-3 h-100">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <span className="badge text-bg-light">{snack.category}</span>
                      <span className={`badge ${snack.processing_status === "failed" ? "text-bg-danger" : snack.processing_status === "processing" ? "text-bg-warning" : "text-bg-success"}`}>
                        {snack.processing_status || "ready"}
                      </span>
                    </div>
                    <h3 className="h6 fw-bold">{snack.title}</h3>
                    <p className="text-muted small">{snack.description || "No description."}</p>
                    <video src={snack.video_url} className="w-100 rounded bg-dark" controls />
                    {Array.isArray(snack.video_variants) && snack.video_variants.length > 0 && (
                      <div className="d-flex flex-wrap gap-2 mt-3">
                        {snack.video_variants.map((variant) => (
                          <span
                            key={variant.resolution}
                            className={`badge ${variant.status === "ready" ? "text-bg-success" : variant.status === "failed" ? "text-bg-danger" : "text-bg-secondary"}`}
                          >
                            {variant.resolution}: {variant.status}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showUploadModal && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ background: "rgba(15,23,42,0.45)", zIndex: 1200 }}>
            <div className="card shadow-lg border-0 overflow-hidden" style={{ width: "100%", maxWidth: 740, borderRadius: 18 }}>
              <div className="card-header border-0 text-white p-4" style={{ background: "linear-gradient(90deg,#071d3d,#0a5dea)" }}>
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <p className="mb-1 small text-uppercase text-light">Admin Upload</p>
                    <h2 className="h4 mb-1">Upload Sell It Snack</h2>
                    <p className="mb-0 text-light small">Upload a video and publish it to a selected snack section.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-light rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: 32, height: 32 }}
                    onClick={() => setShowUploadModal(false)}
                    aria-label="Close"
                  >
                    x
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="card-body p-4" style={{ maxHeight: "68vh", overflowY: "auto" }}>
                  <div className="rounded-3 border bg-light p-3 mb-3">
                    <p className="small text-uppercase text-muted mb-2">Publishing Setup</p>
                    <label className="form-label fw-semibold">Select Section</label>
                    <select
                      className="form-select"
                      value={form.category}
                      onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                      required
                    >
                      {SNACK_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-3 border p-3 mb-3">
                    <p className="small text-uppercase text-muted mb-2">Video Content</p>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Video Title</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                        className="form-control"
                        placeholder="How to tell stories that build your brand"
                        required
                      />
                    </div>
                    <div className="mb-0">
                      <label className="form-label fw-semibold">Description</label>
                      <textarea
                        value={form.description}
                        onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                        className="form-control"
                        rows={4}
                        placeholder="Add detailed description"
                      />
                    </div>
                  </div>

                  <div className="rounded-3 border p-3">
                    <p className="small text-uppercase text-muted mb-2">Media Files</p>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Select Video</label>
                      <input
                        type="file"
                        accept="video/*"
                        className="form-control"
                        onChange={(event) => setForm((prev) => ({ ...prev, video: event.target.files?.[0] || null }))}
                        required
                      />
                      <small className="text-muted">Selected file will be uploaded and saved as a URL in DB.</small>
                    </div>
                    <div className="mb-0">
                      <label className="form-label fw-semibold">Upload Thumbnail</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="form-control"
                        onChange={(event) => setForm((prev) => ({ ...prev, thumbnail: event.target.files?.[0] || null }))}
                      />
                      <small className="text-muted">Thumbnail is optional, but recommended for student and trainer cards.</small>
                    </div>
                  </div>
                </div>

                <div className="card-footer bg-white border-0 px-4 pb-4 pt-2">
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" onClick={() => setShowUploadModal(false)} className="btn btn-outline-secondary px-4">Cancel</button>
                    <button type="submit" className="btn btn-primary px-4" disabled={isSubmitting}>
                      {isSubmitting ? "Uploading..." : "Upload Video"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardSectionPage>
  );
}

