import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../utils/apiBaseUrl";

import {
  FiBriefcase,
  FiChevronDown,
  FiChevronRight,
  FiExternalLink,
  FiEdit2,
  FiFileText,
  FiFolder,
  FiHeart,
  FiMessageCircle,
  FiMoreHorizontal,
  FiPlus,
  FiRefreshCw,
  FiStar,
  FiTrash2,
  FiUpload,
} from "react-icons/fi";
import { DOCUMENT_CENTER_CATEGORIES } from "../utils/documentCenterStorage";
import { resolvePublicMediaUrl } from "../utils/mediaUrl";
import { GenericListSkeleton } from "./skeletons/LoadingSkeletons";

const HERO_DESK_IMG =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=80";

const SORT_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "oldest", label: "Oldest" },
  { value: "title", label: "Title A–Z" },
];

function formatBytes(n) {
  const num = Number(n) || 0;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentCenterTemplatesContent({ variant }) {
  const isAdmin = variant === "admin";
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsErr, setItemsErr] = useState("");
  const [sort, setSort] = useState("latest");
  const [sortOpen, setSortOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [filterMoreOpen, setFilterMoreOpen] = useState(false);
  const [toolbarMoreOpen, setToolbarMoreOpen] = useState(false);
  const [cardMenuId, setCardMenuId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState("add");
  const [editorDraft, setEditorDraft] = useState(null);
  const [editorSaveErr, setEditorSaveErr] = useState("");
  const [engagementNotice, setEngagementNotice] = useState("");
  const sortWrapRef = useRef(null);
  const filterMoreRef = useRef(null);
  const toolbarMoreRef = useRef(null);
  const fileUploadInputRef = useRef(null);

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  const detailBasePath = isAdmin ? "/dashboard/document-center-management" : "/dashboard/student-document-center";

  const showEngagementNotice = useCallback((msg) => {
    setEngagementNotice(msg);
    window.setTimeout(() => setEngagementNotice(""), 4500);
  }, []);

  const [libraryFiles, setLibraryFiles] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryErr, setLibraryErr] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);

  useEffect(() => {
    if (!editorOpen || !isAdmin) return;
    const token = localStorage.getItem("token");
    if (!token) {
      setLibraryErr("Please sign in to load files.");
      return;
    }
    let cancelled = false;
    (async () => {
      setLibraryLoading(true);
      setLibraryErr("");
      try {
        const res = await fetch(`${apiBaseUrl}/api/document-center/files`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json();
        if (cancelled) return;
        if (!res.ok || payload.status !== "success") {
          throw new Error(payload.message || "Could not load document files.");
        }
        setLibraryFiles(Array.isArray(payload.data?.files) ? payload.data.files : []);
      } catch (e) {
        if (!cancelled) setLibraryErr(e.message || "Could not load files.");
      } finally {
        if (!cancelled) setLibraryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editorOpen, isAdmin, apiBaseUrl]);

  const fetchItems = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setItemsErr("Please sign in to load documents.");
      setItems([]);
      setItemsLoading(false);
      return;
    }
    setItemsLoading(true);
    setItemsErr("");
    try {
      const q = isAdmin ? "?include_inactive=1" : "";
      const res = await fetch(`${apiBaseUrl}/api/document-center/items${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Could not load documents.");
      }
      setItems(Array.isArray(payload.data) ? payload.data : []);
    } catch (e) {
      setItemsErr(e.message || "Could not load documents.");
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, [apiBaseUrl, isAdmin]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (!sortOpen) return undefined;
    const onDown = (e) => {
      if (!sortWrapRef.current?.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [sortOpen]);

  useEffect(() => {
    if (!filterMoreOpen) return undefined;
    const onDown = (e) => {
      if (!filterMoreRef.current?.contains(e.target)) setFilterMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filterMoreOpen]);

  useEffect(() => {
    if (!toolbarMoreOpen) return undefined;
    const onDown = (e) => {
      if (!toolbarMoreRef.current?.contains(e.target)) setToolbarMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [toolbarMoreOpen]);

  useEffect(() => {
    if (cardMenuId == null) return undefined;
    const onDown = (e) => {
      const t = e.target;
      if (t.closest?.(".doc-center-card-menu")) return;
      if (t.closest?.(".doc-center-card-dots")) return;
      setCardMenuId(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [cardMenuId]);

  const filteredSorted = useMemo(() => {
    let list = [...items];
    if (category !== "All") {
      list = list.filter((x) => String(x.category || "") === category);
    }
    list.sort((a, b) => {
      if (sort === "title") {
        return String(a.title || "").localeCompare(String(b.title || ""), undefined, {
          sensitivity: "base",
        });
      }
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return sort === "oldest" ? ta - tb : tb - ta;
    });
    return list;
  }, [items, category, sort]);

  const primaryFilters = ["All", ...DOCUMENT_CENTER_CATEGORIES.slice(0, 6)];
  const overflowCategories = DOCUMENT_CENTER_CATEGORIES.slice(6);

  const handleUploadPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !isAdmin) return;
    const token = localStorage.getItem("token");
    if (!token) {
      setLibraryErr("Please sign in to upload.");
      return;
    }
    setUploadBusy(true);
    setLibraryErr("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${apiBaseUrl}/api/document-center/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Upload failed.");
      }
      const url = String(payload.data?.url || "").trim();
      const originalName = String(payload.data?.originalName || file.name || "").trim();
      if (url) {
        setEditorDraft((d) =>
          d ? { ...d, fileUrl: url, fileName: originalName } : d,
        );
      }
      const listRes = await fetch(`${apiBaseUrl}/api/document-center/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const listPayload = await listRes.json();
      if (listRes.ok && listPayload.status === "success" && Array.isArray(listPayload.data?.files)) {
        setLibraryFiles(listPayload.data.files);
      }
    } catch (e) {
      setLibraryErr(e.message || "Upload failed.");
    } finally {
      setUploadBusy(false);
    }
  };

  const openAdd = () => {
    setEditorSaveErr("");
    setEditorMode("add");
    setEditorDraft({
      title: "",
      subtitle: "",
      category: DOCUMENT_CENTER_CATEGORIES[0],
      seriesLabel: "2026 Business Planning Series",
      headerTone: "blue",
      cardLabel: "",
      fileUrl: "",
      fileName: "",
    });
    setEditorOpen(true);
    setToolbarMoreOpen(false);
  };

  const openEdit = (doc) => {
    setEditorSaveErr("");
    setEditorMode("edit");
    setEditorDraft({ ...doc });
    setEditorOpen(true);
    setCardMenuId(null);
  };

  const saveEditor = async () => {
    if (!editorDraft?.title?.trim()) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const tone = editorDraft.headerTone === "navy" ? "navy" : "blue";
    const cat = String(editorDraft.category || "Branding").trim();
    const body = {
      title: editorDraft.title.trim(),
      subtitle: String(editorDraft.subtitle || cat).trim(),
      category: cat,
      seriesLabel: String(editorDraft.seriesLabel || "").trim() || "Templates",
      headerTone: tone,
      cardLabel: String(editorDraft.cardLabel || cat).trim(),
      fileUrl: String(editorDraft.fileUrl || "").trim(),
      fileName: String(editorDraft.fileName || "").trim(),
    };
    setEditorSaveErr("");
    try {
      if (editorMode === "add") {
        const res = await fetch(`${apiBaseUrl}/api/document-center/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        const payload = await res.json();
        if (!res.ok || payload.status !== "success") {
          throw new Error(payload.message || "Could not save document.");
        }
      } else {
        const res = await fetch(`${apiBaseUrl}/api/document-center/items/${editorDraft.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        const payload = await res.json();
        if (!res.ok || payload.status !== "success") {
          throw new Error(payload.message || "Could not update document.");
        }
      }
      setEditorOpen(false);
      setEditorDraft(null);
      await fetchItems();
    } catch (e) {
      setEditorSaveErr(e.message || "Save failed.");
    }
  };

  const deleteDoc = async (id) => {
    if (!window.confirm("Remove this document from the catalog?")) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/document-center/items/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Delete failed.");
      }
      setCardMenuId(null);
      await fetchItems();
    } catch (e) {
      setItemsErr(e.message || "Delete failed.");
    }
  };

  const bumpLike = async (doc) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/document-center/items/${doc.id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        showEngagementNotice(payload.message || "Could not update like.");
        setCardMenuId(null);
        return;
      }
      if (payload.alreadyLiked) {
        showEngagementNotice("You already liked this.");
      }
      const next = payload.data;
      setItems((prev) => prev.map((x) => (Number(x.id) === Number(next.id) ? { ...x, ...next } : x)));
    } catch {
      showEngagementNotice("Could not update like. Try again.");
    }
    setCardMenuId(null);
  };

  const bumpComment = (doc) => {
    navigate(`${detailBasePath}/${doc.id}#compose`);
    setCardMenuId(null);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "document-center-catalog.json";
    a.click();
    URL.revokeObjectURL(a.href);
    setToolbarMoreOpen(false);
  };

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label || "Latest";

  return (
    <div className="doc-center-page">
      <div className="doc-center-toolbar">
        <div className="doc-center-toolbar-title">
          <span className="doc-center-toolbar-icon" aria-hidden>
            <FiBriefcase />
          </span>
          <h1 className="doc-center-toolbar-heading">Documents &amp; Templates</h1>
        </div>
        <div className="doc-center-toolbar-actions">
          <div className="doc-center-sort-wrap" ref={sortWrapRef}>
            <button
              type="button"
              className="doc-center-sort-btn"
              aria-expanded={sortOpen}
              onClick={() => setSortOpen((v) => !v)}
            >
              {sortLabel}
              <FiChevronDown className="doc-center-sort-chevron" aria-hidden />
            </button>
            {sortOpen ? (
              <div className="doc-center-sort-menu" role="listbox">
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    className={`doc-center-sort-item ${sort === o.value ? "is-active" : ""}`}
                    onClick={() => {
                      setSort(o.value);
                      setSortOpen(false);
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" className="doc-center-star-btn" aria-label="Highlights" title="Highlights">
            <FiStar />
          </button>
          <div className="doc-center-toolbar-more-wrap" ref={toolbarMoreRef}>
            <button
              type="button"
              className="doc-center-icon-btn"
              aria-label="More options"
              aria-expanded={toolbarMoreOpen}
              onClick={() => setToolbarMoreOpen((v) => !v)}
            >
              <FiMoreHorizontal />
            </button>
            {toolbarMoreOpen ? (
              <div className="doc-center-toolbar-menu" role="menu">
                {isAdmin ? (
                  <button type="button" role="menuitem" className="doc-center-toolbar-menu-item" onClick={openAdd}>
                    <FiPlus className="me-2" aria-hidden />
                    Add document
                  </button>
                ) : null}
                {isAdmin ? (
                  <button type="button" role="menuitem" className="doc-center-toolbar-menu-item" onClick={exportJson}>
                    Export catalog (JSON)
                  </button>
                ) : (
                  <span className="doc-center-toolbar-menu-note px-3 py-2 small text-muted">
                    Saved templates sync with your organization catalog.
                  </span>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <section className="doc-center-hero" aria-label="Exclusive document center">
        <div className="doc-center-hero-left">
          <span className="doc-center-hero-badge">Membership</span>
          <h2 className="doc-center-hero-title">Exclusive document center</h2>
          <p className="doc-center-hero-sub">
            The ultimate collection of templates, guides, and more.
          </p>
        </div>
        <div className="doc-center-hero-right" role="img" aria-label="Modern workspace">
          <div className="doc-center-hero-right-img" style={{ backgroundImage: `url(${HERO_DESK_IMG})` }} />
          <div className="doc-center-hero-right-overlay" aria-hidden />
        </div>
      </section>

      <div className="doc-center-filters">
        {primaryFilters.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`doc-center-filter-pill ${category === cat ? "is-active" : ""}`}
            onClick={() => {
              setCategory(cat);
              setFilterMoreOpen(false);
            }}
          >
            {cat}
          </button>
        ))}
        {overflowCategories.length ? (
          <div className="doc-center-filter-more-wrap" ref={filterMoreRef}>
            <button
              type="button"
              className={`doc-center-filter-pill doc-center-filter-more ${overflowCategories.includes(category) ? "is-active" : ""}`}
              aria-expanded={filterMoreOpen}
              onClick={() => setFilterMoreOpen((v) => !v)}
            >
              More
              <FiChevronDown className="doc-center-filter-more-icon" aria-hidden />
            </button>
            {filterMoreOpen ? (
              <div className="doc-center-filter-more-menu">
                {overflowCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={category === cat ? "is-active" : ""}
                    onClick={() => {
                      setCategory(cat);
                      setFilterMoreOpen(false);
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isAdmin ? (
        <div className="doc-center-admin-bar">
          <div className="doc-center-admin-bar-text">
            <strong>Manage catalog</strong>
            <span>Add, edit, or hide documents. Students only see active items.</span>
          </div>
          <button type="button" className="doc-center-btn-primary" onClick={openAdd}>
            <FiPlus aria-hidden />
            Add document
          </button>
        </div>
      ) : null}

      {itemsErr ? (
        <div className="doc-center-alert doc-center-alert--danger" role="alert">
          <div className="doc-center-alert-body">
            <span className="doc-center-alert-title">Could not load documents</span>
            <span className="doc-center-alert-msg">{itemsErr}</span>
          </div>
          <button type="button" className="doc-center-btn-retry" onClick={() => fetchItems()}>
            <FiRefreshCw aria-hidden />
            Retry
          </button>
        </div>
      ) : null}

      {engagementNotice ? (
        <div className="doc-center-alert doc-center-alert--warn" role="status">
          {engagementNotice}
        </div>
      ) : null}

      {itemsLoading ? (
        <div className="doc-center-skeleton-grid" aria-busy="true" aria-label="Loading documents">
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <div key={k} className="doc-center-skeleton-card">
              <div className="doc-center-skeleton-shine doc-center-skeleton-hero" />
              <div className="doc-center-skeleton-body">
                <div className="doc-center-skeleton-shine doc-center-skeleton-line doc-center-skeleton-line--lg" />
                <div className="doc-center-skeleton-shine doc-center-skeleton-line" />
                <div className="doc-center-skeleton-shine doc-center-skeleton-line doc-center-skeleton-line--sm" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="doc-center-grid">
            {filteredSorted.map((doc) => (
              <article
                key={doc.id}
                className={`doc-center-card${doc.isActive === false ? " doc-center-card--inactive" : ""}`}
              >
                <div
                  className={`doc-center-card-hero doc-center-card-hero--${doc.headerTone === "navy" ? "navy" : "blue"}`}
                >
                  <div className="doc-center-card-hero-tags">
                    <span className="doc-center-card-series">{doc.seriesLabel || "Series"}</span>
                    {isAdmin && doc.isActive === false ? (
                      <span className="doc-center-card-hidden-pill">Hidden</span>
                    ) : null}
                  </div>
                  <div className="doc-center-card-hero-menu-wrap">
                    <button
                      type="button"
                      className="doc-center-card-dots"
                      aria-label="Document actions"
                      aria-expanded={cardMenuId === doc.id}
                      onClick={() => setCardMenuId((c) => (c === doc.id ? null : doc.id))}
                    >
                      <FiMoreHorizontal />
                    </button>
                    {cardMenuId === doc.id ? (
                      <div className="doc-center-card-menu" role="menu">
                        {doc.fileUrl ? (
                          <a
                            role="menuitem"
                            className="doc-center-card-menu-item"
                            href={resolvePublicMediaUrl(doc.fileUrl, apiBaseUrl)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setCardMenuId(null)}
                          >
                            <FiExternalLink className="me-2" aria-hidden />
                            Open
                          </a>
                        ) : null}
                        {isAdmin ? (
                          <button
                            type="button"
                            role="menuitem"
                            className="doc-center-card-menu-item"
                            onClick={() => openEdit(doc)}
                          >
                            <FiEdit2 className="me-2" aria-hidden />
                            Edit
                          </button>
                        ) : null}
                        {isAdmin ? (
                          <button
                            type="button"
                            role="menuitem"
                            className="doc-center-card-menu-item doc-center-card-menu-item--danger"
                            onClick={() => deleteDoc(doc.id)}
                          >
                            <FiTrash2 className="me-2" aria-hidden />
                            Delete
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="doc-center-card-hero-center">
                    <span className="doc-center-card-hero-label">{doc.cardLabel || doc.category || "Template"}</span>
                  </div>
                </div>
                <div className="doc-center-card-body">
                  <h3 className="doc-center-card-title">{doc.title}</h3>
                  <p className="doc-center-card-sub">{doc.subtitle || doc.category}</p>
                  <div className="doc-center-card-footer">
                    <Link
                      to={`${detailBasePath}/${doc.id}`}
                      className="doc-center-card-view-link"
                      onClick={() => setCardMenuId(null)}
                    >
                      View details
                      <FiChevronRight className="doc-center-card-view-chevron" aria-hidden />
                    </Link>
                    <div className="doc-center-card-footer-engage">
                      <button
                        type="button"
                        className={`doc-center-engage doc-center-engage--chip${doc.likedByMe ? " doc-center-engage--liked" : ""}`}
                        onClick={() => bumpLike(doc)}
                        title="Like"
                        aria-pressed={doc.likedByMe}
                      >
                        <FiHeart className="doc-center-engage-icon" aria-hidden />
                        <span>{Number(doc.likes || 0)}</span>
                      </button>
                      <button
                        type="button"
                        className="doc-center-engage doc-center-engage--chip"
                        onClick={() => bumpComment(doc)}
                        title="Comment"
                      >
                        <FiMessageCircle className="doc-center-engage-icon" aria-hidden />
                        <span>{Number(doc.comments || 0)}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!itemsLoading && filteredSorted.length === 0 ? (
            <div className="doc-center-empty-state">
              <div className="doc-center-empty-icon" aria-hidden>
                <FiFolder />
              </div>
              <p className="doc-center-empty-title">No documents here</p>
              <p className="doc-center-empty-sub">
                {category === "All"
                  ? "Nothing in the catalog yet. Try another category or check back later."
                  : `No items in “${category}”. Pick another category or clear filters.`}
              </p>
              {isAdmin ? (
                <button type="button" className="doc-center-btn-primary doc-center-btn-primary--ghost" onClick={openAdd}>
                  <FiFileText aria-hidden />
                  Add your first document
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {editorOpen && editorDraft ? (
        <div className="doc-center-modal-layer" role="presentation">
          <button
            type="button"
            className="doc-center-modal-backdrop"
            aria-label="Close"
            onClick={() => {
              setEditorOpen(false);
              setEditorDraft(null);
              setEditorSaveErr("");
            }}
          />
          <div className="doc-center-modal" role="dialog" aria-modal="true" aria-labelledby="doc-center-editor-title">
            <h2 id="doc-center-editor-title" className="doc-center-modal-title">
              {editorMode === "add" ? "Add document" : "Edit document"}
            </h2>
            <div className="doc-center-modal-scroll">
            <label className="doc-center-field">
              <span>Title</span>
              <input
                className="form-control"
                value={editorDraft.title || ""}
                onChange={(e) => setEditorDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </label>
            <label className="doc-center-field">
              <span>Subtitle / line under title</span>
              <input
                className="form-control"
                value={editorDraft.subtitle || ""}
                onChange={(e) => setEditorDraft((d) => ({ ...d, subtitle: e.target.value }))}
              />
            </label>
            <label className="doc-center-field">
              <span>Category</span>
              <select
                className="form-select"
                value={editorDraft.category || ""}
                onChange={(e) => setEditorDraft((d) => ({ ...d, category: e.target.value }))}
              >
                {DOCUMENT_CENTER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="doc-center-field">
              <span>Series badge</span>
              <input
                className="form-control"
                value={editorDraft.seriesLabel || ""}
                onChange={(e) => setEditorDraft((d) => ({ ...d, seriesLabel: e.target.value }))}
              />
            </label>
            <label className="doc-center-field">
              <span>Card header label</span>
              <input
                className="form-control"
                value={editorDraft.cardLabel || ""}
                onChange={(e) => setEditorDraft((d) => ({ ...d, cardLabel: e.target.value }))}
                placeholder="Shown large on card header"
              />
            </label>
            <label className="doc-center-field">
              <span>Header style</span>
              <select
                className="form-select"
                value={editorDraft.headerTone || "blue"}
                onChange={(e) => setEditorDraft((d) => ({ ...d, headerTone: e.target.value }))}
              >
                <option value="blue">Blue</option>
                <option value="navy">Navy</option>
              </select>
            </label>
            <div className="doc-center-field">
              <span>File (server library)</span>
              <div className="doc-center-file-toolbar">
                <input
                  ref={fileUploadInputRef}
                  type="file"
                  className="d-none"
                  onChange={handleUploadPick}
                  disabled={uploadBusy}
                />
                <button
                  type="button"
                  className="doc-center-upload-btn"
                  disabled={uploadBusy}
                  onClick={() => fileUploadInputRef.current?.click()}
                >
                  <FiUpload className="me-1" aria-hidden />
                  {uploadBusy ? "Uploading…" : "Upload to library"}
                </button>
              </div>
              {libraryErr ? (
                <p className="doc-center-field-error" role="status">
                  {libraryErr}
                </p>
              ) : null}
              <div className="doc-center-file-list">
                {libraryLoading ? <GenericListSkeleton count={5} className="doc-center-file-list-hint" /> : null}
                {!libraryLoading && libraryFiles.length === 0 ? (
                  <p className="doc-center-file-list-hint">No files yet — upload above to add to the library.</p>
                ) : null}
                {libraryFiles.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    className={`doc-center-file-row ${editorDraft.fileUrl === f.url ? "is-selected" : ""}`}
                    onClick={() =>
                      setEditorDraft((d) => (d ? { ...d, fileUrl: f.url, fileName: f.name } : d))
                    }
                  >
                    <span className="doc-center-file-row-name">{f.name}</span>
                    <span className="doc-center-file-row-meta">
                      {formatBytes(f.size)} · {f.mtime ? new Date(f.mtime).toLocaleString() : ""}
                    </span>
                  </button>
                ))}
              </div>
              {editorDraft.fileUrl ? (
                <p className="doc-center-file-selected">
                  Selected: <strong>{editorDraft.fileName || editorDraft.fileUrl}</strong>
                </p>
              ) : (
                <p className="doc-center-file-selected doc-center-file-selected--muted">
                  Optional — attach a file for the Open link on the card.
                </p>
              )}
            </div>
            {editorSaveErr ? (
              <div className="doc-center-inline-error" role="alert">
                {editorSaveErr}
              </div>
            ) : null}
            </div>
            <div className="doc-center-modal-actions">
              <button
                type="button"
                className="doc-center-modal-btn doc-center-modal-btn--secondary"
                onClick={() => {
                  setEditorOpen(false);
                  setEditorDraft(null);
                  setEditorSaveErr("");
                }}
              >
                Cancel
              </button>
              <button type="button" className="doc-center-modal-btn doc-center-modal-btn--primary" onClick={saveEditor}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
