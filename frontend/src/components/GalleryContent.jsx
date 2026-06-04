import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiFolder, FiHeart, FiImage, FiPlus } from "react-icons/fi";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { resolvePublicMediaUrl } from "../utils/mediaUrl";

export default function GalleryContent({ variant }) {
  const isAdmin = variant === "admin";
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const listBase = isAdmin ? "/dashboard/gallery-management" : "/dashboard/student-gallery";

  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderDesc, setFolderDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchFolders = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setErr("Please sign in.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const q = isAdmin ? "?include_inactive=1" : "";
      const res = await fetch(`${apiBaseUrl}/api/gallery/folders${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Could not load folders.");
      }
      setFolders(Array.isArray(payload.data) ? payload.data : []);
    } catch (e) {
      setErr(e.message || "Could not load folders.");
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, isAdmin]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const createFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setCreating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/gallery/folders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, description: folderDesc.trim() }),
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Could not create folder.");
      }
      setFolderName("");
      setFolderDesc("");
      setShowCreate(false);
      await fetchFolders();
    } catch (e) {
      setErr(e.message || "Could not create folder.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="gallery-page">
      <div className="gallery-toolbar">
        <div>
          <h1 className="gallery-toolbar-title">Photo Gallery</h1>
          <p className="gallery-toolbar-sub">
            {isAdmin ? "Create folders and upload images for members to view." : "Browse folders and images from your community."}
          </p>
        </div>
        {isAdmin ? (
          <button type="button" className="gallery-btn-primary" onClick={() => setShowCreate(true)}>
            <FiPlus aria-hidden />
            New folder
          </button>
        ) : null}
      </div>

      {err ? <div className="gallery-alert">{err}</div> : null}

      {showCreate && isAdmin ? (
        <div className="gallery-modal-layer" role="presentation">
          <button type="button" className="gallery-modal-backdrop" aria-label="Close" onClick={() => setShowCreate(false)} />
          <div className="gallery-modal" role="dialog" aria-modal="true">
            <h2 className="gallery-modal-title">Create folder</h2>
            <label className="gallery-field">
              <span>Folder name</span>
              <input
                type="text"
                className="form-control"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. Spring 2026 Event"
              />
            </label>
            <label className="gallery-field">
              <span>Description (optional)</span>
              <textarea
                className="form-control"
                rows={3}
                value={folderDesc}
                onChange={(e) => setFolderDesc(e.target.value)}
                placeholder="Short description for members"
              />
            </label>
            <div className="gallery-modal-actions">
              <button type="button" className="gallery-btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="gallery-btn-primary"
                disabled={creating || !folderName.trim()}
                onClick={createFolder}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="gallery-folder-grid" aria-busy="true" aria-label="Loading gallery folders">
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <div key={k} className="gallery-folder-card gallery-folder-card--skeleton" aria-hidden>
              <div className="gallery-folder-card-cover">
                <div className="gallery-skeleton-shine gallery-skeleton-cover" />
              </div>
              <div className="gallery-folder-card-body">
                <div className="gallery-skeleton-shine gallery-skeleton-line gallery-skeleton-line--title" />
                <div className="gallery-skeleton-shine gallery-skeleton-line gallery-skeleton-line--desc" />
                <div className="gallery-skeleton-shine gallery-skeleton-line gallery-skeleton-line--desc-short" />
                <div className="gallery-folder-card-meta gallery-skeleton-meta">
                  <div className="gallery-skeleton-shine gallery-skeleton-pill" />
                  <div className="gallery-skeleton-shine gallery-skeleton-pill" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && folders.length === 0 ? (
        <div className="gallery-empty">
          <FiFolder className="gallery-empty-icon" aria-hidden />
          <p className="gallery-empty-title">No folders yet</p>
          <p className="gallery-empty-sub">
            {isAdmin ? "Create your first folder, then upload images inside it." : "Check back when your admin adds gallery folders."}
          </p>
        </div>
      ) : null}

      {!loading && folders.length > 0 ? (
        <div className="gallery-folder-grid">
          {folders.map((f) => {
            const coverSrc = f.coverImageUrl ? resolvePublicMediaUrl(f.coverImageUrl, apiBaseUrl) : "";
            return (
              <Link
                key={f.id}
                to={`${listBase}/${f.id}`}
                className={`gallery-folder-card${f.isActive === false ? " gallery-folder-card--inactive" : ""}`}
              >
                <div className="gallery-folder-card-cover">
                  {coverSrc ? (
                    <img src={coverSrc} alt="" className="gallery-folder-card-cover-img" loading="lazy" />
                  ) : (
                    <div className="gallery-folder-card-cover-placeholder" aria-hidden>
                      <FiFolder />
                      <span>No images yet</span>
                    </div>
                  )}
                  {f.isActive === false && isAdmin ? <span className="gallery-hidden-pill">Hidden</span> : null}
                </div>
                <div className="gallery-folder-card-body">
                  <h2 className="gallery-folder-card-name">{f.name}</h2>
                  {f.description ? <p className="gallery-folder-card-desc">{f.description}</p> : null}
                  <div className="gallery-folder-card-meta">
                    <span>
                      <FiImage aria-hidden /> {Number(f.imageCount || 0)}
                    </span>
                    <span className={f.likedByMe ? "is-liked" : ""}>
                      <FiHeart aria-hidden /> {Number(f.likes || 0)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
