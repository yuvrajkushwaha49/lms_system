import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiHeart, FiImage, FiTrash2, FiUpload, FiX } from "react-icons/fi";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { resolvePublicMediaUrl } from "../utils/mediaUrl";
import GalleryCommentSection from "./GalleryCommentSection";

export default function GalleryFolderDetailPage({ variant }) {
  const isAdmin = variant === "admin";
  const { folderId } = useParams();
  const navigate = useNavigate();
  const id = Number(folderId);
  const listPath = isAdmin ? "/dashboard/gallery-management" : "/dashboard/student-gallery";

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const fileInputRef = useRef(null);

  const [folder, setFolder] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const showNotice = useCallback((msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 4000);
  }, []);

  const loadFolder = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) {
      setErr("Invalid folder.");
      setLoading(false);
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      setErr("Please sign in.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const [fRes, iRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/gallery/folders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBaseUrl}/api/gallery/folders/${id}/images`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const fPayload = await fRes.json();
      const iPayload = await iRes.json();
      if (!fRes.ok || fPayload.status !== "success") {
        throw new Error(fPayload.message || "Folder not found.");
      }
      setFolder(fPayload.data || null);
      setImages(iRes.ok && iPayload.status === "success" && Array.isArray(iPayload.data) ? iPayload.data : []);
    } catch (e) {
      setErr(e.message || "Could not load folder.");
      setFolder(null);
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, id]);

  useEffect(() => {
    loadFolder();
  }, [loadFolder]);

  const likeFolder = async () => {
    if (!folder || folder.likedByMe) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/gallery/folders/${folder.id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        showNotice(payload.message || "Could not like folder.");
        return;
      }
      if (payload.alreadyLiked) showNotice("You already liked this folder.");
      setFolder((f) => (f ? { ...f, likes: payload.data?.likes ?? f.likes, likedByMe: true } : f));
    } catch {
      showNotice("Could not like folder.");
    }
  };

  const likeImage = async (img) => {
    if (!img || img.likedByMe) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/gallery/images/${img.id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") return;
      const patch = { likes: payload.data?.likes, likedByMe: true };
      setImages((prev) => prev.map((x) => (Number(x.id) === Number(img.id) ? { ...x, ...patch } : x)));
      if (selectedImage && Number(selectedImage.id) === Number(img.id)) {
        setSelectedImage((s) => (s ? { ...s, ...patch } : s));
      }
    } catch {
      /* ignore */
    }
  };

  const uploadImages = async (fileList) => {
    if (!folder || !fileList?.length) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setUploading(true);
    try {
      const body = new FormData();
      Array.from(fileList).forEach((f) => body.append("images", f));
      const res = await fetch(`${apiBaseUrl}/api/gallery/folders/${folder.id}/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Upload failed.");
      }
      showNotice(`${(payload.data || []).length} image(s) uploaded.`);
      await loadFolder();
    } catch (e) {
      showNotice(e.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteImage = async (img) => {
    if (!isAdmin || !img) return;
    if (!window.confirm("Remove this image from the gallery?")) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/gallery/images/${img.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        showNotice(payload.message || "Could not delete image.");
        return;
      }
      if (selectedImage?.id === img.id) setSelectedImage(null);
      await loadFolder();
    } catch {
      showNotice("Could not delete image.");
    }
  };

  const deleteFolder = async () => {
    if (!isAdmin || !folder) return;
    if (!window.confirm("Hide this folder and all its images?")) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/gallery/folders/${folder.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        showNotice(payload.message || "Could not delete folder.");
        return;
      }
      navigate(listPath);
    } catch {
      showNotice("Could not delete folder.");
    }
  };

  return (
    <div className="gallery-page gallery-detail-page">
      <div className="gallery-detail-toolbar">
        <button type="button" className="gallery-back-btn" onClick={() => navigate(listPath)}>
          <FiArrowLeft aria-hidden />
          Back
        </button>
        <Link to={listPath} className="gallery-back-link">
          All folders
        </Link>
      </div>

      {notice ? <div className="gallery-notice">{notice}</div> : null}

      {loading ? (
        <div className="gallery-detail-loading" aria-busy="true" aria-label="Loading folder">
          <div className="gallery-detail-header gallery-detail-header--skeleton">
            <div className="gallery-detail-header-main">
              <div className="gallery-skeleton-shine gallery-skeleton-line gallery-skeleton-line--detail-title" />
              <div className="gallery-skeleton-shine gallery-skeleton-line gallery-skeleton-line--detail-desc" />
              <div className="gallery-detail-engage">
                <div className="gallery-skeleton-shine gallery-skeleton-pill gallery-skeleton-pill--engage" />
                <div className="gallery-skeleton-shine gallery-skeleton-pill gallery-skeleton-pill--engage" />
              </div>
            </div>
          </div>
          <div className="gallery-image-grid">
            {[1, 2, 3, 4, 5, 6].map((k) => (
              <div key={k} className="gallery-image-card gallery-image-card--skeleton" aria-hidden>
                <div className="gallery-skeleton-shine gallery-skeleton-image-thumb" />
                <div className="gallery-image-card-footer">
                  <div className="gallery-skeleton-shine gallery-skeleton-pill" />
                  <div className="gallery-skeleton-shine gallery-skeleton-pill" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && err ? (
        <div className="gallery-empty">
          <p className="gallery-empty-title">{err}</p>
          <button type="button" className="gallery-btn-primary" onClick={() => navigate(listPath)}>
            Return to gallery
          </button>
        </div>
      ) : null}

      {!loading && folder ? (
        <>
          <header className="gallery-detail-header">
            <div className="gallery-detail-header-main">
              <h1 className="gallery-detail-title">{folder.name}</h1>
              {folder.description ? <p className="gallery-detail-desc">{folder.description}</p> : null}
              <div className="gallery-detail-engage">
                <button
                  type="button"
                  className={`gallery-like-btn${folder.likedByMe ? " is-liked" : ""}`}
                  onClick={likeFolder}
                  aria-pressed={folder.likedByMe}
                >
                  <FiHeart aria-hidden />
                  <span>{Number(folder.likes || 0)}</span>
                </button>
                <span className="gallery-detail-count">
                  <FiImage aria-hidden /> {images.length} image{images.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            {isAdmin ? (
              <div className="gallery-admin-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="d-none"
                  onChange={(e) => uploadImages(e.target.files)}
                />
                <button
                  type="button"
                  className="gallery-btn-primary"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FiUpload aria-hidden />
                  {uploading ? "Uploading…" : "Upload images"}
                </button>
                <button type="button" className="gallery-btn-danger" onClick={deleteFolder}>
                  <FiTrash2 aria-hidden />
                  Delete folder
                </button>
              </div>
            ) : null}
          </header>

          {images.length === 0 ? (
            <div className="gallery-empty gallery-empty--compact">
              <p className="gallery-empty-sub">
                {isAdmin ? "No images in this folder yet. Use Upload images above." : "No images in this folder yet."}
              </p>
            </div>
          ) : (
            <div className="gallery-image-grid">
              {images.map((img) => {
                const src = resolvePublicMediaUrl(img.fileUrl, apiBaseUrl);
                return (
                  <article key={img.id} className="gallery-image-card">
                    <button type="button" className="gallery-image-thumb-btn" onClick={() => setSelectedImage(img)}>
                      <img src={src} alt={img.title || img.fileName || "Gallery image"} className="gallery-image-thumb" />
                    </button>
                    <div className="gallery-image-card-footer">
                      <button
                        type="button"
                        className={`gallery-image-like${img.likedByMe ? " is-liked" : ""}`}
                        onClick={() => likeImage(img)}
                        aria-pressed={img.likedByMe}
                      >
                        <FiHeart aria-hidden />
                        {Number(img.likes || 0)}
                      </button>
                      <button type="button" className="gallery-image-open" onClick={() => setSelectedImage(img)}>
                        View
                      </button>
                      {isAdmin ? (
                        <button type="button" className="gallery-image-delete" onClick={() => deleteImage(img)} aria-label="Delete">
                          <FiTrash2 aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <GalleryCommentSection
            apiBaseUrl={apiBaseUrl}
            commentsEndpoint={`/api/gallery/folders/${folder.id}/comments`}
            postEndpoint={`/api/gallery/folders/${folder.id}/comments`}
            likeCommentEndpoint={(cid) => `/api/gallery/comments/${cid}/like`}
            title="Folder comments"
            studentActions={!isAdmin}
          />
        </>
      ) : null}

      {selectedImage ? (
        <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label="Image detail">
          <button type="button" className="gallery-lightbox-backdrop" aria-label="Close" onClick={() => setSelectedImage(null)} />
          <div className="gallery-lightbox-panel">
            <button type="button" className="gallery-lightbox-close" onClick={() => setSelectedImage(null)} aria-label="Close">
              <FiX aria-hidden />
            </button>
            <img
              src={resolvePublicMediaUrl(selectedImage.fileUrl, apiBaseUrl)}
              alt={selectedImage.title || selectedImage.fileName || "Gallery image"}
              className="gallery-lightbox-img"
            />
            <div className="gallery-lightbox-meta">
              <h2 className="gallery-lightbox-title">{selectedImage.title || selectedImage.fileName || "Image"}</h2>
              {selectedImage.caption ? <p className="gallery-lightbox-caption">{selectedImage.caption}</p> : null}
              <button
                type="button"
                className={`gallery-like-btn${selectedImage.likedByMe ? " is-liked" : ""}`}
                onClick={() => likeImage(selectedImage)}
                aria-pressed={selectedImage.likedByMe}
              >
                <FiHeart aria-hidden />
                <span>{Number(selectedImage.likes || 0)}</span>
              </button>
            </div>
            <GalleryCommentSection
              apiBaseUrl={apiBaseUrl}
              commentsEndpoint={`/api/gallery/images/${selectedImage.id}/comments`}
              postEndpoint={`/api/gallery/images/${selectedImage.id}/comments`}
              likeCommentEndpoint={(cid) => `/api/gallery/comments/${cid}/like`}
              title="Image comments"
              studentActions={!isAdmin}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
