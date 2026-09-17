import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiEdit2, FiFolder, FiHeart, FiImage, FiPlus, FiTrash2 } from "react-icons/fi";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { resolvePublicMediaUrl } from "../utils/mediaUrl";
import ConfirmPopup from "./ConfirmPopup";

export default function GalleryContent({ variant }) {
  const isAdmin = variant === "admin";
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const listBase = isAdmin ? "/dashboard/gallery-management" : "/dashboard/student-gallery";

  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [folderName, setFolderName] = useState("");
  const [folderDesc, setFolderDesc] = useState("");
  const [folderActive, setFolderActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isEditMode = editId != null;

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

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const openCreateModal = () => {
    setEditId(null);
    setFolderName("");
    setFolderDesc("");
    setFolderActive(true);
    setErr("");
    setShowModal(true);
  };

  const openEditModal = (folder) => {
    setEditId(folder.id);
    setFolderName(folder.name || "");
    setFolderDesc(folder.description || "");
    setFolderActive(folder.isActive !== false);
    setErr("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditId(null);
    setFolderName("");
    setFolderDesc("");
    setFolderActive(true);
  };

  const saveFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setSaving(true);
    setErr("");
    try {
      const body = {
        name,
        description: folderDesc.trim(),
        ...(isEditMode ? { is_active: folderActive } : {}),
      };
      const res = await fetch(
        isEditMode
          ? `${apiBaseUrl}/api/gallery/folders/${editId}`
          : `${apiBaseUrl}/api/gallery/folders`,
        {
          method: isEditMode ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(
          payload.message || (isEditMode ? "Could not update folder." : "Could not create folder."),
        );
      }
      if (payload.data) {
        if (isEditMode) {
          setFolders((prev) =>
            prev.map((f) => (String(f.id) === String(payload.data.id) ? { ...f, ...payload.data } : f)),
          );
          setNotice("Folder updated.");
        } else {
          setFolders((prev) => [payload.data, ...prev]);
          setNotice("Folder created.");
        }
      }
      closeModal();
    } catch (e) {
      setErr(e.message || (isEditMode ? "Could not update folder." : "Could not create folder."));
    } finally {
      setSaving(false);
    }
  };

  const openDeletePopup = (folder) => {
    setDeleteTarget(folder);
    setErr("");
  };

  const closeDeletePopup = () => {
    if (isDeleting) return;
    setDeleteTarget(null);
  };

  const confirmDeleteFolder = async () => {
    if (!deleteTarget) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setIsDeleting(true);
    setErr("");
    try {
      const res = await fetch(`${apiBaseUrl}/api/gallery/folders/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Could not delete folder.");
      }
      setFolders((prev) =>
        prev.map((f) =>
          String(f.id) === String(deleteTarget.id) ? { ...f, isActive: false } : f,
        ),
      );
      setNotice("Folder hidden.");
      setDeleteTarget(null);
    } catch (e) {
      setErr(e.message || "Could not delete folder.");
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="gallery-page">
      <div className="gallery-toolbar">
        <div>
          <h1 className="gallery-toolbar-title">Photo Gallery</h1>
          <p className="gallery-toolbar-sub">
            {isAdmin
              ? "Create folders and upload images for members to view."
              : "Browse folders and images from your community."}
          </p>
        </div>
        {isAdmin ? (
          <button type="button" className="gallery-btn-primary" onClick={openCreateModal}>
            <FiPlus aria-hidden />
            New folder
          </button>
        ) : null}
      </div>

      {err ? (
        <div className="gallery-alert d-flex align-items-center justify-content-between gap-2">
          <span>{err}</span>
          <button type="button" className="btn-close" aria-label="Close" onClick={() => setErr("")} />
        </div>
      ) : null}
      {notice ? (
        <div className="alert alert-success py-2 d-flex align-items-center justify-content-between gap-2" role="alert">
          <span>{notice}</span>
          <button type="button" className="btn-close" aria-label="Close" onClick={() => setNotice("")} />
        </div>
      ) : null}

      {showModal && isAdmin ? (
        <div className="gallery-modal-layer" role="presentation">
          <button type="button" className="gallery-modal-backdrop" aria-label="Close" onClick={closeModal} />
          <div className="gallery-modal" role="dialog" aria-modal="true">
            <h2 className="gallery-modal-title">{isEditMode ? "Edit folder" : "Create folder"}</h2>
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
            {isEditMode ? (
              <label className="gallery-field gallery-field-check">
                <input
                  type="checkbox"
                  checked={folderActive}
                  onChange={(e) => setFolderActive(e.target.checked)}
                />
                <span>Visible to members</span>
              </label>
            ) : null}
            <div className="gallery-modal-actions">
              <button type="button" className="gallery-btn-secondary" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                className="gallery-btn-primary"
                disabled={saving || !folderName.trim()}
                onClick={saveFolder}
              >
                {saving ? (isEditMode ? "Saving…" : "Creating…") : isEditMode ? "Save changes" : "Create"}
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
            {isAdmin
              ? "Create your first folder, then upload images inside it."
              : "Check back when your admin adds gallery folders."}
          </p>
        </div>
      ) : null}

      {!loading && folders.length > 0 ? (
        <div className="gallery-folder-grid">
          {folders.map((f) => {
            const coverSrc = f.coverImageUrl ? resolvePublicMediaUrl(f.coverImageUrl, apiBaseUrl) : "";
            return (
              <article
                key={f.id}
                className={`gallery-folder-card${f.isActive === false ? " gallery-folder-card--inactive" : ""}`}
              >
                <Link to={`${listBase}/${f.id}`} className="gallery-folder-card-link">
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
                {isAdmin ? (
                  <div className="gallery-folder-card-actions">
                    <button
                      type="button"
                      className="gallery-icon-btn"
                      title="Edit folder"
                      aria-label="Edit folder"
                      onClick={() => openEditModal(f)}
                    >
                      <FiEdit2 size={15} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="gallery-icon-btn gallery-icon-btn--danger"
                      title="Hide folder"
                      aria-label="Hide folder"
                      onClick={() => openDeletePopup(f)}
                    >
                      <FiTrash2 size={15} aria-hidden />
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      <ConfirmPopup
        open={Boolean(deleteTarget)}
        title="Hide folder?"
        message={
          deleteTarget
            ? `Hide “${deleteTarget.name}” and its images from members?`
            : ""
        }
        confirmLabel="Hide"
        cancelLabel="Cancel"
        confirmVariant="danger"
        busy={isDeleting}
        onConfirm={confirmDeleteFolder}
        onCancel={closeDeletePopup}
      />
    </div>
  );
}
