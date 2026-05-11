import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiEdit2, FiHelpCircle, FiPlus, FiSearch, FiX } from "react-icons/fi";
import DashboardSectionPage from "./DashboardSectionPage";

const initialForm = {
  question: "",
  answer: "",
  sort_order: 0,
  is_active: true,
};

export default function FaqManagementPage() {
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [editFaqId, setEditFaqId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [expandedById, setExpandedById] = useState({});

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || "http://localhost:5003").replace(/\/$/, ""),
    [],
  );

  const fetchFaqs = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/faqs?include_inactive=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to fetch FAQs.");
      }
      setFaqs(Array.isArray(payload.data) ? payload.data : []);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to fetch FAQs.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, navigate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchFaqs, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchFaqs]);

  const sortedFaqs = useMemo(
    () =>
      [...faqs].sort((a, b) => {
        const orderA = Number(a.sort_order) || 0;
        const orderB = Number(b.sort_order) || 0;
        if (orderA !== orderB) return orderA - orderB;
        return Number(a.id) - Number(b.id);
      }),
    [faqs],
  );

  const filteredFaqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedFaqs;
    return sortedFaqs.filter((row) => {
      const question = String(row.question || "").toLowerCase();
      const answer = String(row.answer || "").toLowerCase();
      return question.includes(q) || answer.includes(q);
    });
  }, [sortedFaqs, search]);

  const activeCount = useMemo(() => faqs.filter((f) => f.is_active).length, [faqs]);

  const openCreateFaqModal = () => {
    setEditFaqId(null);
    setForm(initialForm);
    setShowFaqModal(true);
  };

  const openEditFaqModal = (faq) => {
    setEditFaqId(faq.id);
    setForm({
      question: String(faq.question || ""),
      answer: String(faq.answer || ""),
      sort_order: Number(faq.sort_order) || 0,
      is_active: Boolean(faq.is_active),
    });
    setShowFaqModal(true);
  };

  const closeFaqModal = () => {
    setShowFaqModal(false);
    setEditFaqId(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    if (!form.question.trim() || !form.answer.trim()) {
      setError("Question and answer are required.");
      return;
    }
    const isEdit = editFaqId != null;
    try {
      setIsSubmitting(true);
      setError("");
      setNotice("");
      const body = {
        question: form.question.trim(),
        answer: form.answer.trim(),
        sort_order: Number(form.sort_order) || 0,
        is_active: Boolean(form.is_active),
      };
      const response = await fetch(
        isEdit ? `${apiBaseUrl}/api/faqs/${editFaqId}` : `${apiBaseUrl}/api/faqs`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || (isEdit ? "Unable to update FAQ." : "Unable to upload FAQ."));
      }
      setNotice(isEdit ? "FAQ updated successfully." : "FAQ uploaded successfully.");
      closeFaqModal();
      await fetchFaqs();
    } catch (submitError) {
      setError(submitError.message || (isEdit ? "Unable to update FAQ." : "Unable to upload FAQ."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (faq) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      setError("");
      setNotice("");
      const response = await fetch(`${apiBaseUrl}/api/faqs/${faq.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !faq.is_active }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to update FAQ status.");
      }
      await fetchFaqs();
    } catch (toggleError) {
      setError(toggleError.message || "Unable to update FAQ status.");
    }
  };

  const handleDelete = async (faqId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      setError("");
      setNotice("");
      const response = await fetch(`${apiBaseUrl}/api/faqs/${faqId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to delete FAQ.");
      }
      setNotice("FAQ deleted successfully.");
      await fetchFaqs();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete FAQ.");
    }
  };

  const toggleExpanded = (id) => {
    setExpandedById((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAllVisible = () => {
    const next = { ...expandedById };
    filteredFaqs.forEach((row) => {
      next[row.id] = true;
    });
    setExpandedById(next);
  };

  const collapseAll = () => setExpandedById({});

  return (
    <DashboardSectionPage title="FAQs Management">
      <div className="container-fluid px-0 faq-admin-page" style={{ maxWidth: 1200 }}>
        <div
          className="lms-card p-4 p-md-5 mb-3 text-white border-0"
          style={{
            background: "linear-gradient(90deg,#071d3d,#0d2f69 45%,#0a5dea)",
            boxShadow: "0 16px 40px rgba(7, 29, 61, 0.22)",
          }}
        >
          <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
            <div className="d-flex gap-3 align-items-start">
              <span
                className="d-none d-sm-flex rounded-3 align-items-center justify-content-center flex-shrink-0"
                style={{ width: 52, height: 52, background: "rgba(255,255,255,0.14)" }}
                aria-hidden
              >
                <FiHelpCircle size={26} />
              </span>
              <div>
                <p className="small text-uppercase text-white-50 mb-1" style={{ letterSpacing: "0.06em" }}>
                  Content
                </p>
                <h1 className="h2 fw-bold mb-2">FAQs Management</h1>
                <p className="mb-0 text-light" style={{ maxWidth: 520 }}>
                  Upload and manage frequently asked questions. Students only see active entries on their FAQ page.
                </p>
                {!isLoading && faqs.length > 0 && (
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <span className="badge rounded-pill px-3 py-2" style={{ background: "rgba(255,255,255,0.18)" }}>
                      {faqs.length} total
                    </span>
                    <span className="badge rounded-pill px-3 py-2" style={{ background: "rgba(34,197,94,0.35)" }}>
                      {activeCount} active
                    </span>
                    <span className="badge rounded-pill px-3 py-2" style={{ background: "rgba(255,255,255,0.12)" }}>
                      {faqs.length - activeCount} inactive
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-light rounded-pill px-4 fw-semibold d-inline-flex align-items-center gap-2"
              onClick={openCreateFaqModal}
            >
              <FiPlus size={18} aria-hidden />
              Upload FAQ
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
        {notice && <div className="alert alert-success py-2 mb-3">{notice}</div>}

        <div className="lms-card p-3 p-md-4 mb-3">
          <label className="visually-hidden" htmlFor="faq-admin-search">
            Search FAQs
          </label>
          <div className="position-relative">
            <FiSearch
              className="position-absolute text-muted"
              size={18}
              style={{ left: 14, top: "50%", transform: "translateY(-50%)" }}
              aria-hidden
            />
            <input
              id="faq-admin-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by question or answer…"
              className="form-control form-control-lg ps-5"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="lms-card p-0 overflow-hidden">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 px-md-4 py-3 border-bottom bg-light bg-opacity-50">
            <h2 className="h5 fw-semibold mb-0">Uploaded FAQs</h2>
            <div className="d-flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={expandAllVisible} disabled={filteredFaqs.length === 0}>
                Expand all
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={collapseAll} disabled={faqs.length === 0}>
                Collapse all
              </button>
            </div>
          </div>

          <div className="p-3 p-md-4">
            {isLoading ? (
              <div className="d-flex align-items-center gap-2 text-muted py-4 justify-content-center">
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden />
                <span>Loading FAQs…</span>
              </div>
            ) : faqs.length === 0 ? (
              <div className="text-center text-muted py-5 px-2">
                <FiHelpCircle className="mb-3 opacity-50" size={40} aria-hidden />
                <p className="mb-1 fw-semibold text-dark">No FAQs yet</p>
                <p className="mb-3 small">Create your first entry with the Upload FAQ button.</p>
                <button type="button" className="btn btn-primary rounded-pill px-4" onClick={openCreateFaqModal}>
                  Upload FAQ
                </button>
              </div>
            ) : filteredFaqs.length === 0 ? (
              <p className="text-muted text-center py-4 mb-0">No FAQs match your search.</p>
            ) : (
              <div className="accordion faq-admin-accordion" id="faq-admin-accordion">
                {filteredFaqs.map((faq) => {
                  const isOpen = Boolean(expandedById[faq.id]);
                  const collapseId = `faq-admin-collapse-${faq.id}`;
                  return (
                    <div key={faq.id} className="accordion-item">
                      <h3 className="accordion-header">
                        <button
                          type="button"
                          className={`accordion-button ${isOpen ? "" : "collapsed"}`}
                          onClick={() => toggleExpanded(faq.id)}
                          aria-expanded={isOpen}
                          aria-controls={collapseId}
                          id={`${collapseId}-heading`}
                        >
                          <span className="d-flex flex-grow-1 align-items-start gap-2 gap-md-3 me-2 text-start flex-wrap">
                            <span className="fw-semibold text-dark flex-grow-1" style={{ minWidth: 0 }}>
                              {faq.question}
                            </span>
                            <span className={`badge flex-shrink-0 ${faq.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                              {faq.is_active ? "Active" : "Inactive"}
                            </span>
                            <span className="badge text-bg-light text-muted border flex-shrink-0">Order {Number(faq.sort_order || 0)}</span>
                          </span>
                        </button>
                      </h3>
                      <div
                        id={collapseId}
                        className={`accordion-collapse collapse ${isOpen ? "show" : ""}`}
                        role="region"
                        aria-labelledby={`${collapseId}-heading`}
                      >
                        <div className="accordion-body pt-0">
                          <p className="text-secondary mb-4" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                            {faq.answer}
                          </p>
                          <div className="d-flex flex-wrap justify-content-end gap-2 pt-2 border-top">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditFaqModal(faq);
                              }}
                            >
                              <FiEdit2 size={14} aria-hidden />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleToggleActive(faq);
                              }}
                            >
                              {faq.is_active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete(faq.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {showFaqModal && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ background: "rgba(15,23,42,0.45)", zIndex: 1200 }}>
            <div className="card shadow-lg border-0 overflow-hidden" style={{ width: "100%", maxWidth: 740, borderRadius: 18 }}>
              <div className="card-header border-0 text-white p-4" style={{ background: "linear-gradient(90deg,#071d3d,#0a5dea)" }}>
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <p className="mb-1 small text-uppercase text-light">{editFaqId != null ? "Admin edit" : "Admin upload"}</p>
                    <h2 className="h4 mb-1">{editFaqId != null ? "Edit FAQ" : "Upload FAQ"}</h2>
                    <p className="mb-0 text-light small">
                      {editFaqId != null
                        ? "Update this entry. Changes apply immediately on the student FAQ page for active items."
                        : "Add a question-answer entry for the student FAQ page."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-light rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: 36, height: 36 }}
                    onClick={closeFaqModal}
                    aria-label="Close"
                  >
                    <FiX size={18} aria-hidden />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="card-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Question</label>
                    <input
                      type="text"
                      value={form.question}
                      onChange={(event) => setForm((prev) => ({ ...prev, question: event.target.value }))}
                      className="form-control"
                      placeholder="How can I access workshop replays?"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Answer</label>
                    <textarea
                      value={form.answer}
                      onChange={(event) => setForm((prev) => ({ ...prev, answer: event.target.value }))}
                      className="form-control"
                      rows={5}
                      placeholder="You can find workshop replays in Sell It Starter > Live Workshops."
                      required
                    />
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Display Order</label>
                      <select
                        className="form-select"
                        value={String(form.sort_order)}
                        onChange={(event) => setForm((prev) => ({ ...prev, sort_order: Number(event.target.value) }))}
                      >
                        {Array.from({ length: 21 }, (_, idx) => (
                          <option key={idx} value={idx}>
                            {idx}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Status</label>
                      <select
                        className="form-select"
                        value={String(form.is_active)}
                        onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.value === "true" }))}
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="card-footer bg-white border-0 px-4 pb-4 pt-2">
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" onClick={closeFaqModal} className="btn btn-outline-secondary px-4">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary px-4" disabled={isSubmitting}>
                      {isSubmitting ? (editFaqId != null ? "Saving…" : "Uploading…") : editFaqId != null ? "Save changes" : "Upload FAQ"}
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

