import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { useNavigate } from "react-router-dom";
import { FiFilm, FiImage, FiUpload, FiVideo } from "react-icons/fi";
import DashboardSectionPage from "./DashboardSectionPage";
import CommunityVideoPlayer from "../../components/CommunityVideoPlayer";
import { resolveWelcomeVideoPresentation } from "../../utils/welcomeVideoEmbed";

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WelcomeVideoManagementPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const thumbInputRef = useRef(null);
  const [form, setForm] = useState({
    video_url: "",
    thumbnail_url: "",
    video_caption: "",
    body_text: "",
    transcript_text: "",
  });
  const [pendingVideoFile, setPendingVideoFile] = useState(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState("");
  const [pendingThumbFile, setPendingThumbFile] = useState(null);
  const [pendingThumbPreviewUrl, setPendingThumbPreviewUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  useEffect(() => {
    if (!pendingVideoFile) {
      setPendingPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(pendingVideoFile);
    setPendingPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingVideoFile]);

  useEffect(() => {
    if (!pendingThumbFile) {
      setPendingThumbPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(pendingThumbFile);
    setPendingThumbPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingThumbFile]);

  const savedPresentation = useMemo(() => resolveWelcomeVideoPresentation(form.video_url), [form.video_url]);

  const applyVideoFile = useCallback((file) => {
    setError("");
    if (!file) {
      setPendingVideoFile(null);
      return;
    }
    if (!String(file.type || "").toLowerCase().startsWith("video/")) {
      setError("Only video files are allowed.");
      setPendingVideoFile(null);
      return;
    }
    setPendingVideoFile(file);
  }, []);

  const applyThumbFile = useCallback((file) => {
    setError("");
    if (!file) {
      setPendingThumbFile(null);
      return;
    }
    if (!String(file.type || "").toLowerCase().startsWith("image/")) {
      setError("Thumbnail must be an image file (PNG, JPG, WebP, etc.).");
      setPendingThumbFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Thumbnail must be 5 MB or smaller.");
      setPendingThumbFile(null);
      return;
    }
    setPendingThumbFile(file);
  }, []);

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/welcome-video`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to load welcome video.");
      }
      setForm({
        video_url: payload.data?.video_url || "",
        thumbnail_url: payload.data?.thumbnail_url || "",
        video_caption: payload.data?.video_caption || "",
        body_text: payload.data?.body_text || "",
        transcript_text: payload.data?.transcript_text || "",
      });
      setPendingVideoFile(null);
      setPendingThumbFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (thumbInputRef.current) thumbInputRef.current.value = "";
    } catch (e) {
      setError(e.message || "Unable to load welcome video.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, navigate]);

  useEffect(() => {
    const id = window.setTimeout(load, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const handleVideoFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setPendingVideoFile(null);
      return;
    }
    applyVideoFile(file);
    if (!String(file.type || "").toLowerCase().startsWith("video/") && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearPendingVideo = () => {
    setPendingVideoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearPendingThumb = () => {
    setPendingThumbFile(null);
    if (thumbInputRef.current) thumbInputRef.current.value = "";
  };

  const handleThumbFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setPendingThumbFile(null);
      return;
    }
    applyThumbFile(file);
    if (!String(file.type || "").toLowerCase().startsWith("image/") && thumbInputRef.current) {
      thumbInputRef.current.value = "";
    }
  };

  const openThumbPicker = () => thumbInputRef.current?.click();

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0] || null;
    if (file) applyVideoFile(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDragActive(false);
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleDropzoneKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      setIsSaving(true);
      setError("");
      setNotice("");

      let response;
      const useMultipart = Boolean(pendingVideoFile || pendingThumbFile);
      if (useMultipart) {
        const fd = new FormData();
        if (pendingVideoFile) fd.append("video", pendingVideoFile);
        if (pendingThumbFile) fd.append("thumbnail", pendingThumbFile);
        fd.append("video_caption", form.video_caption);
        fd.append("body_text", form.body_text);
        fd.append("transcript_text", form.transcript_text);
        response = await fetch(`${apiBaseUrl}/api/welcome-video`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
      } else {
        response = await fetch(`${apiBaseUrl}/api/welcome-video`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        });
      }

      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to save.");
      }
      setNotice("Welcome video settings saved.");
      await load();
    } catch (e) {
      setError(e.message || "Unable to save.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardSectionPage title="Welcome video">
      <div className="admin-welcome-video-page container-fluid px-0">
        <header className="admin-welcome-video-hero">
          <div className="admin-welcome-video-hero-inner">
            <span className="admin-welcome-video-hero-kicker">
              <FiVideo size={14} aria-hidden />
              Start Here
            </span>
            <h1 className="admin-welcome-video-hero-title">Welcome video</h1>
            <p className="admin-welcome-video-hero-lede">
              This is the first impression on <strong className="admin-welcome-video-hero-strong">Start Here</strong> — upload
              one clear welcome clip (same flow as the community feed). Caption and supporting copy are optional.
            </p>
            <div className="admin-welcome-video-meta">
              <span className="admin-welcome-video-pill">Video only</span>
              <span className="admin-welcome-video-pill">Up to 100 MB</span>
              <span className="admin-welcome-video-pill">Thumbnail optional · max 5 MB</span>
              <span className="admin-welcome-video-pill">Hosted on your server</span>
            </div>
          </div>
        </header>

        <div className="admin-welcome-video-shell">
          {error && <div className="alert alert-danger py-3 px-3 mb-0 admin-welcome-video-alert">{error}</div>}
          {notice && <div className="alert alert-success py-3 px-3 mb-0 admin-welcome-video-alert">{notice}</div>}

          {isLoading ? (
            <div className="admin-welcome-video-loading" aria-busy="true" aria-label="Loading welcome video settings">
              <div className="admin-welcome-video-skeleton" />
              <div className="admin-welcome-video-skeleton short" />
              <p className="text-muted small mb-0 mt-3">Loading settings…</p>
            </div>
          ) : (
            <form onSubmit={handleSave} noValidate>
              <div className="admin-welcome-video-body">
                <section className="admin-welcome-video-section" aria-labelledby="welcome-video-media-heading">
                  <div className="admin-welcome-video-section-head">
                    <div>
                      <h2 id="welcome-video-media-heading" className="admin-welcome-video-section-title">
                        Video file
                      </h2>
                      <p className="admin-welcome-video-section-hint">
                        Drag and drop a file here, or use the button. Only video formats. Saving with a new file replaces the
                        current video; you can update text fields anytime without re-uploading.
                      </p>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    id="welcome-video-file"
                    type="file"
                    accept="video/*"
                    className="d-none"
                    onChange={handleVideoFileChange}
                  />

                  {!pendingVideoFile ? (
                    <div
                      tabIndex={0}
                      className={`admin-welcome-video-dropzone${dragActive ? " admin-welcome-video-dropzone--drag" : ""}`}
                      onClick={openFilePicker}
                      onKeyDown={handleDropzoneKeyDown}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      <div className="admin-welcome-video-dropzone-icon" aria-hidden>
                        <FiFilm />
                      </div>
                      <p className="admin-welcome-video-dropzone-title">Drop your welcome video here</p>
                      <p className="admin-welcome-video-dropzone-text">MP4, WebM, MOV, and other browser-supported formats.</p>
                      <div className="admin-welcome-video-dropzone-actions">
                        <button type="button" className="admin-welcome-video-btn-primary" onClick={(e) => { e.stopPropagation(); openFilePicker(); }}>
                          <FiUpload size={18} aria-hidden />
                          Choose video
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="admin-welcome-video-preview-wrap">
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                        <div>
                          <strong className="admin-welcome-video-ready-label">Ready to upload</strong>
                          <span className="text-muted small">Shown on Start Here after you save.</span>
                        </div>
                        <button type="button" className="admin-welcome-video-btn-ghost" onClick={clearPendingVideo}>
                          Remove
                        </button>
                      </div>
                      <p className="admin-welcome-video-file-meta mb-0">
                        {pendingVideoFile.name}
                        {pendingVideoFile.size ? ` · ${formatBytes(pendingVideoFile.size)}` : ""}
                      </p>
                      {pendingPreviewUrl && (
                        <div className="admin-welcome-video-feed-preview student-community-upload-preview mt-3">
                          <div className="student-community-upload-preview-grid">
                            <div className="student-community-upload-preview-tile admin-welcome-video-feed-preview-tile">
                              <CommunityVideoPlayer src={pendingPreviewUrl} title={pendingVideoFile.name} compact />
                              <span>{pendingVideoFile.name}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="mt-3">
                        <button type="button" className="admin-welcome-video-btn-ghost" onClick={openFilePicker}>
                          <FiUpload size={16} className="me-1" aria-hidden />
                          Choose different file
                        </button>
                      </div>
                    </div>
                  )}

                  {!pendingVideoFile && form.video_url && savedPresentation.type === "youtube" && (
                    <div className="admin-welcome-video-legacy" role="status">
                      A <strong>YouTube</strong> link is saved. Upload a video file above to switch to a self-hosted clip
                      (recommended for a consistent player experience).
                    </div>
                  )}

                  {!pendingVideoFile && form.video_url && savedPresentation.type === "file" && (
                    <div className="admin-welcome-video-current-frame">
                      <video
                        controls
                        playsInline
                        src={savedPresentation.src}
                        title="Current welcome video"
                        poster={String(form.thumbnail_url || "").trim() || undefined}
                      >
                        <track kind="captions" />
                      </video>
                    </div>
                  )}

                  {!pendingVideoFile && !form.video_url && (
                    <div className="admin-welcome-video-empty">
                      No video is published yet. Add a file so members see the welcome block on Start Here.
                    </div>
                  )}

                  <div className="admin-welcome-video-thumb-block">
                    <h3 className="h6 fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                      <FiImage size={16} aria-hidden />
                      Upload thumbnail
                    </h3>
                    <p className="admin-welcome-video-section-hint mb-3">
                      Optional poster image before play (like course video thumbnails). Use 16:9 or wide images for best
                      results. PNG, JPG, or WebP — max 5 MB.
                    </p>
                    <input
                      ref={thumbInputRef}
                      id="welcome-thumb-file"
                      type="file"
                      accept="image/*"
                      className="d-none"
                      onChange={handleThumbFileChange}
                    />
                    {pendingThumbFile && pendingThumbPreviewUrl ? (
                      <div>
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                          <div>
                            <strong className="admin-welcome-video-ready-label">New thumbnail selected</strong>
                            <span className="text-muted small d-block">Save to apply on Start Here.</span>
                          </div>
                          <button type="button" className="admin-welcome-video-btn-ghost" onClick={clearPendingThumb}>
                            Remove
                          </button>
                        </div>
                        <p className="admin-welcome-video-file-meta mb-2">
                          {pendingThumbFile.name}
                          {pendingThumbFile.size ? ` · ${formatBytes(pendingThumbFile.size)}` : ""}
                        </p>
                        <img
                          className="admin-welcome-video-thumb-preview-img"
                          src={pendingThumbPreviewUrl}
                          alt=""
                        />
                        <div className="admin-welcome-video-thumb-actions mt-2">
                          <button type="button" className="admin-welcome-video-btn-ghost" onClick={openThumbPicker}>
                            <FiUpload size={16} className="me-1" aria-hidden />
                            Choose different image
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="admin-welcome-video-thumb-dropzone">
                        <p className="mb-0 small text-muted">Shown as the video poster until members press play.</p>
                        <button type="button" className="admin-welcome-video-btn-primary" onClick={openThumbPicker}>
                          <FiImage size={18} aria-hidden />
                          Choose thumbnail
                        </button>
                      </div>
                    )}
                    {!pendingThumbFile && String(form.thumbnail_url || "").trim() && (
                      <div className="mt-3">
                        <p className="small text-muted mb-2">Current saved thumbnail</p>
                        <img
                          className="admin-welcome-video-thumb-preview-img"
                          src={form.thumbnail_url.trim()}
                          alt=""
                        />
                      </div>
                    )}
                  </div>
                </section>

                <div className="admin-welcome-video-divider" aria-hidden />

                <section className="admin-welcome-video-section admin-welcome-video-fields" aria-labelledby="welcome-copy-heading">
                  <div className="admin-welcome-video-section-head">
                    <div>
                      <h2 id="welcome-copy-heading" className="admin-welcome-video-section-title">
                        Copy &amp; transcript
                      </h2>
                      <p className="admin-welcome-video-section-hint">Optional text shown under the player on Start Here.</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label" htmlFor="welcome-video-caption">
                      Line under the video
                    </label>
                    <input
                      id="welcome-video-caption"
                      className="form-control"
                      value={form.video_caption}
                      onChange={(e) => setForm((p) => ({ ...p, video_caption: e.target.value }))}
                      placeholder="Welcome to Sell It. The community built for agents who…"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="welcome-body">
                      Body text
                    </label>
                    <textarea
                      id="welcome-body"
                      className="form-control"
                      rows={8}
                      value={form.body_text}
                      onChange={(e) => setForm((p) => ({ ...p, body_text: e.target.value }))}
                      placeholder="Separate paragraphs with a blank line."
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label" htmlFor="welcome-transcript">
                      Transcript
                    </label>
                    <textarea
                      id="welcome-transcript"
                      className="form-control"
                      rows={6}
                      value={form.transcript_text}
                      onChange={(e) => setForm((p) => ({ ...p, transcript_text: e.target.value }))}
                      placeholder="Shown when members tap “Show transcript”."
                    />
                  </div>
                </section>
              </div>

              <footer className="admin-welcome-video-footer">
                <button type="button" className="btn btn-outline-secondary px-3" onClick={load} disabled={isSaving}>
                  Reload
                </button>
                <button type="submit" className="btn btn-primary admin-welcome-video-footer-save" disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save changes"}
                </button>
              </footer>
            </form>
          )}
        </div>
      </div>
    </DashboardSectionPage>
  );
}
