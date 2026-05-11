import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiHeart, FiImage, FiMessageCircle, FiPlus, FiRefreshCw, FiUploadCloud } from "react-icons/fi";
import { Link } from "react-router-dom";
import DashboardSectionPage from "./DashboardSectionPage";

const canUploadWallOfWins = (user) => {
  const r = String(user?.role_name || "").toLowerCase();
  return ["ceo", "admin"].includes(r);
};

export default function SuperAdminWallOfWinsPage() {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const fileInputRef = useRef(null);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || "http://localhost:5003").replace(/\/$/, ""),
    [],
  );

  const sessionUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const showUpload = canUploadWallOfWins(sessionUser);

  const fetchEntries = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      return;
    }
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/wall-of-wins?limit=100&offset=0&include_blocked=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to load Wall of Wins.");
      }
      setEntries(Array.isArray(payload.data) ? payload.data : []);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to load Wall of Wins.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const id = window.setTimeout(fetchEntries, 0);
    return () => window.clearTimeout(id);
  }, [fetchEntries]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const uploadImage = async () => {
    const file = selectedFile;
    if (!file || !file.type.startsWith("image/")) {
      setError("Please choose an image file (JPEG, PNG, GIF, WebP).");
      return;
    }
    const title = String(uploadTitle || "").trim();
    if (!title) {
      setError("Please add a title before uploading.");
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      setIsUploading(true);
      setError("");
      setNotice("");
      const body = new FormData();
      body.append("title", title);
      body.append("image", file);
      const response = await fetch(`${apiBaseUrl}/api/wall-of-wins`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Upload failed.");
      }
      if (payload.data) {
        setEntries((prev) => [payload.data, ...prev]);
      }
      setNotice("Image added to Wall of Wins.");
      setUploadTitle("");
      setSelectedFile(null);
      setUploadModalOpen(false);
      window.setTimeout(() => setNotice(""), 4000);
    } catch (uploadError) {
      setError(uploadError.message || "Upload failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onDropFiles = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer?.files?.[0];
    if (file) setSelectedFile(file);
  };
  const closeUploadModal = () => {
    setUploadModalOpen(false);
    setUploadTitle("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };


  const setBlocked = async (entryId, blocked) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setBusyId(entryId);
    try {
      const response = await fetch(`${apiBaseUrl}/api/wall-of-wins/${entryId}/block`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ blocked }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to update.");
      }
      setEntries((prev) =>
        prev.map((e) =>
          String(e.id) === String(entryId) ? { ...e, is_blocked: Boolean(blocked) } : e,
        ),
      );
    } catch (blockErr) {
      setError(blockErr.message || "Unable to update.");
    } finally {
      setBusyId(null);
    }
  };

  const removeEntry = async (entryId) => {
    if (!window.confirm("Delete this Wall of Wins entry permanently?")) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setBusyId(entryId);
    try {
      const response = await fetch(`${apiBaseUrl}/api/wall-of-wins/${entryId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to delete.");
      }
      setEntries((prev) => prev.filter((e) => String(e.id) !== String(entryId)));
    } catch (delErr) {
      setError(delErr.message || "Unable to delete.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardSectionPage title="Wall of Wins">
      <div className="wall-of-wins-shell wall-of-wins-admin-page">
        <div className="wall-of-wins-topbar">
          <h1>🏆 Wall of Wins</h1>
          <div className="wall-of-wins-topbar-actions wall-of-wins-admin-head-actions">
            <button type="button" onClick={fetchEntries} disabled={isLoading} title="Refresh list">
              <FiRefreshCw size={15} className={isLoading ? "spin" : ""} />
              <span>{isLoading ? "Refreshing..." : "Latest"}</span>
            </button>
            {showUpload ? (
              <button
                type="button"
                className="wall-of-wins-add-btn"
                onClick={() => {
                  setUploadModalOpen(true);
                  setUploadTitle("");
                  setSelectedFile(null);
                }}
              >
                <FiPlus size={16} />
                <span>Add Win</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="wall-of-wins-banner">
          <div className="wall-of-wins-banner-copy">
            <span className="wall-of-wins-badge">MEMBERSHIP</span>
            <h2>THIS IS WHAT WINNING LOOKS LIKE</h2>
            <p>Think big, act bold. These wins are proof it works.</p>
          </div>
          <div
            className="wall-of-wins-banner-image"
            style={{
              background: entries[0]?.image_url
                ? `url(${entries[0].image_url}) center/cover no-repeat`
                : "linear-gradient(140deg,#dbeafe,#f1f5f9)",
            }}
          />
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}
        {notice && <div className="alert alert-success py-2">{notice}</div>}

        {!showUpload ? (
          <div className="alert alert-secondary py-2 mb-3" role="status">
            Uploading is limited to CEO and Admin. You can still refresh, block, or delete entries below.
          </div>
        ) : null}

        {isLoading && entries.length === 0 ? (
          <div className="lms-card p-5 text-center text-muted">Loading Wall of Wins...</div>
        ) : entries.length === 0 ? (
          <div className="lms-card p-5 text-center text-muted">No uploads yet.</div>
        ) : (
          <div className="wall-of-wins-grid wall-of-wins-admin-grid">
            {entries.map((entry) => (
              <Link
                key={entry.id}
                to={`/dashboard/feed-management/wall-of-wins/${entry.id}`}
                className="wall-of-wins-card-v2 text-decoration-none"
              >
                <div className="wall-of-wins-card-media">
                  <img
                    src={entry.image_url}
                    alt={entry.image_name ? `Win photo from ${entry.user_name || "member"}` : "Win photo"}
                    className="wall-of-wins-thumb"
                    loading="lazy"
                  />
                </div>
                <div className="wall-of-wins-card-foot">
                  <div className="wall-of-wins-card-meta">
                    <span>{entry.title || "Untitled win"}</span>
                    <small>{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : "Recent"}</small>
                  </div>
                  <div className="text-muted small mb-1">{entry.user_name || "Member"}</div>
                  <div className="wall-of-wins-card-stats">
                    <span>
                      <FiHeart size={14} /> 0
                    </span>
                    <span>
                      <FiMessageCircle size={14} /> 0
                    </span>
                  </div>
                  <div className="d-flex gap-2 mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      disabled={busyId === entry.id}
                      onClick={(e) => {
                        e.preventDefault();
                        setBlocked(entry.id, !entry.is_blocked);
                      }}
                    >
                      {entry.is_blocked ? "Unblock" : "Block"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={busyId === entry.id}
                      onClick={(e) => {
                        e.preventDefault();
                        removeEntry(entry.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {showUpload && uploadModalOpen ? (
          <div className="sell-snack-modal wall-of-wins-upload-modal" role="dialog" aria-modal="true">
            <button
              type="button"
              className="sell-snack-modal-backdrop"
              aria-label="Close upload modal"
              onClick={closeUploadModal}
            />
            <div className="sell-snack-modal-card wall-of-wins-upload-card wall-of-wins-ig-modal">
              <button
                type="button"
                className="sell-snack-modal-close"
                aria-label="Close upload modal"
                onClick={closeUploadModal}
              >
                ×
              </button>
              <div className="wall-of-wins-ig-head">
                <h2 className="h6 fw-bold mb-0">Create new post</h2>
                <button
                  type="button"
                  className="btn btn-link text-decoration-none fw-semibold p-0"
                  disabled={isUploading || !selectedFile || !String(uploadTitle || "").trim()}
                  onClick={uploadImage}
                >
                  {isUploading ? "Sharing..." : "Share"}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="d-none"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSelectedFile(file);
                }}
              />
              <div className="wall-of-wins-ig-body">
                <div className="wall-of-wins-ig-preview">
                  {selectedFile ? (
                    <div className="wall-of-wins-preview-media">
                      <img src={previewUrl} alt="Selected upload preview" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="wall-of-wins-upload-zone w-100 h-100 border border-2 border-dashed rounded-3 p-4 p-md-4 text-center bg-light bg-opacity-50"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        onDropFiles(e);
                      }}
                      disabled={isUploading}
                    >
                      <FiUploadCloud size={32} className="text-primary mb-2" aria-hidden />
                      <p className="fw-semibold mb-1">Choose image</p>
                      <p className="text-muted small mb-2">
                        Click or drag an image — JPG, PNG, GIF or WebP
                      </p>
                      <span className="badge bg-primary bg-opacity-10 text-primary">
                        <FiImage className="me-1" aria-hidden />
                        Images only
                      </span>
                    </button>
                  )}
                </div>
                <div className="wall-of-wins-ig-form">
                  <label htmlFor="wall-win-title" className="form-label fw-semibold mb-1">
                    Title
                  </label>
                  <input
                    id="wall-win-title"
                    type="text"
                    className="form-control mb-3"
                    placeholder="Write a title..."
                    maxLength={255}
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                  />
                  {selectedFile ? (
                    <p className="small text-muted mb-2">{selectedFile.name}</p>
                  ) : (
                    <p className="small text-muted mb-2">No image selected</p>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    Change image
                  </button>
                  <div className="d-flex justify-content-end gap-2 mt-3">
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={closeUploadModal}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={isUploading || !selectedFile || !String(uploadTitle || "").trim()}
                      onClick={uploadImage}
                    >
                      {isUploading ? "Uploading..." : "Share"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardSectionPage>
  );
}

