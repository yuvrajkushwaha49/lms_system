import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import sellitStarterImage from "../../assets/Sell It Starter FAQ Cover Image.png";


import {
  FiBookmark,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiMaximize2,
  FiMinimize2,
  FiMoreHorizontal,
  FiX,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";

/** Split FAQ answer into paragraphs and bullet/numbered lists (lines like "- item" or "1. item"). */
function parseFaqAnswerBody(text) {
  const raw = String(text ?? "").replace(/\r\n/g, "\n");
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const lines = raw.split("\n");
  const segments = [];
  let paraLines = [];
  let listItems = [];

  const flushPara = () => {
    if (paraLines.length) {
      const t = paraLines.join("\n").trim();
      if (t) segments.push({ type: "p", text: t });
      paraLines = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      segments.push({ type: "list", items: listItems.slice() });
      listItems = [];
    }
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[\).\]]\s+(.*)$/);
    const content = bullet?.[1] ?? numbered?.[1];
    if (content != null && String(content).trim() !== "") {
      flushPara();
      listItems.push(String(content).trim());
      continue;
    }
    if (!line.trim()) {
      flushList();
      flushPara();
      continue;
    }
    flushList();
    paraLines.push(line);
  }
  flushList();
  flushPara();

  if (!segments.length) return [{ type: "p", text: trimmed }];
  return segments;
}

export default function StudentFaqsPage() {
  const [faqs, setFaqs] = useState([]);
  const [modalFaq, setModalFaq] = useState(null);
  const [modalExpanded, setModalExpanded] = useState(false);
  const [modalBookmarked, setModalBookmarked] = useState(false);
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  const fetchFaqs = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      return;
    }
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/faqs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to fetch FAQs.");
      }
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setFaqs(rows);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to fetch FAQs.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchFaqs, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchFaqs]);

  const fetchMembers = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/users/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") return;
      const users = Array.isArray(payload.data) ? payload.data : [];
      setMembers(users);
    } catch {
      // Keep members panel optional; ignore loading failures.
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchMembers, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchMembers]);

  const modalFaqIndex = useMemo(() => {
    if (!modalFaq) return -1;
    const activeId = Number(modalFaq.id);
    return faqs.findIndex((row) => Number(row.id) === activeId);
  }, [faqs, modalFaq]);

  const modalHasPrev = modalFaqIndex > 0;
  const modalHasNext = modalFaqIndex >= 0 && modalFaqIndex < faqs.length - 1;

  const goToPrevFaq = useCallback(() => {
    if (!modalHasPrev) return;
    setModalFaq(faqs[modalFaqIndex - 1]);
  }, [faqs, modalFaqIndex, modalHasPrev]);

  const goToNextFaq = useCallback(() => {
    if (!modalHasNext) return;
    setModalFaq(faqs[modalFaqIndex + 1]);
  }, [faqs, modalFaqIndex, modalHasNext]);

  useEffect(() => {
    if (!modalFaq) return undefined;
    setModalExpanded(false);
    setModalBookmarked(false);
    const onKeyDown = (event) => {
      if (event.key === "Escape") setModalFaq(null);
      if (event.key === "ArrowLeft") goToPrevFaq();
      if (event.key === "ArrowRight") goToNextFaq();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [goToNextFaq, goToPrevFaq, modalFaq]);

  const modalAnswerSegments = useMemo(
    () => (modalFaq ? parseFaqAnswerBody(modalFaq.answer) : []),
    [modalFaq],
  );

  const handleUpgradeClick = () => {
    setModalFaq(null);
    navigate("/dashboard/student-start-here");
  };

  return (
    <StudentDashboardSectionPage title="FAQs">
      <div className="container-fluid px-0 student-faq-page-wrap">
        <section className="student-faq-top-strip">
          <div className="student-faq-top-left">
            <span className="student-faq-top-qmark">?</span>
            <span className="student-faq-top-label">FAQs</span>
          </div>
          <div className="student-faq-top-right">
            <button type="button" className="student-faq-top-icon-btn" aria-label="Sparkle">✦</button>
            <button
              type="button"
              className="student-faq-members-trigger"
              onClick={() => navigate("/dashboard/student-members")}
              aria-label="Open members page"
            >
              <div className="student-faq-avatar-stack" aria-hidden="true">
                <span>M</span>
                <span>A</span>
                <span>A</span>
              </div>
              <span className="student-faq-top-count">{members.length} Students</span>
            </button>
            <button type="button" className="student-faq-top-dots" aria-label="More options">···</button>
          </div>
        </section>

     <div className="student-community-filters">
               <img src={sellitStarterImage} alt="Filters" />
             </div>
        <section className="student-faq-list-card">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          {isLoading ? (
            <p className="text-muted mb-0">Loading FAQs...</p>
          ) : faqs.length === 0 ? (
            <p className="text-muted mb-0">No FAQs available yet.</p>
          ) : (
            <div className="student-faq-list">
              {faqs.map((faq) => (
                <div key={faq.id} className="student-faq-item">
                  <button
                    type="button"
                    className="student-faq-question"
                    onClick={() => setModalFaq(faq)}
                    aria-haspopup="dialog"
                    aria-expanded={modalFaq != null && Number(modalFaq.id) === Number(faq.id)}
                  >
                    <span className="student-faq-question-left">→ {faq.question}</span>
                    <span className="student-faq-question-right student-faq-question-chevron" aria-hidden>
                      <FiChevronRight size={22} />
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {modalFaq && (
          <div
            className={`student-faq-modal-overlay ${modalExpanded ? "is-fullscreen" : ""}`}
            role="presentation"
          >
            <button
              type="button"
              className="student-faq-modal-backdrop"
              aria-label="Close FAQ"
              onClick={() => setModalFaq(null)}
            />
            <div className="student-faq-modal-shell">
              <button
                type="button"
                className="student-faq-modal-side-nav student-faq-modal-side-nav--left"
                onClick={(event) => {
                  event.stopPropagation();
                  goToPrevFaq();
                }}
                disabled={!modalHasPrev}
                aria-label="Previous FAQ"
              >
                <FiChevronLeft size={28} aria-hidden />
              </button>
              <button
                type="button"
                className="student-faq-modal-side-nav student-faq-modal-side-nav--right"
                onClick={(event) => {
                  event.stopPropagation();
                  goToNextFaq();
                }}
                disabled={!modalHasNext}
                aria-label="Next FAQ"
              >
                <FiChevronRight size={28} aria-hidden />
              </button>

              <div
                className={`student-faq-modal-panel ${modalExpanded ? "student-faq-modal-panel--wide" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="student-faq-modal-title"
              >
              <div className="student-faq-modal-accent" aria-hidden="true" />

              <div className="student-faq-modal-top">
                <h2 id="student-faq-modal-title" className="student-faq-modal-title">
                  <span className="student-faq-modal-title-arrow" aria-hidden="true">
                    →
                  </span>
                  <span className="student-faq-modal-title-text">{modalFaq.question}</span>
                </h2>
                <div className="student-faq-modal-toolbar">
                  <button
                    type="button"
                    className={`student-faq-modal-icon-btn ${modalBookmarked ? "is-active" : ""}`}
                    onClick={() => setModalBookmarked((v) => !v)}
                    aria-label={modalBookmarked ? "Remove bookmark" : "Bookmark"}
                    aria-pressed={modalBookmarked}
                  >
                    <FiBookmark size={18} fill={modalBookmarked ? "currentColor" : "none"} />
                  </button>
                  <button
                    type="button"
                    className="student-faq-modal-icon-btn"
                    onClick={() => setModalExpanded((v) => !v)}
                    aria-label={modalExpanded ? "Exit expanded view" : "Expand"}
                  >
                    {modalExpanded ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
                  </button>
                  <button
                    type="button"
                    className="student-faq-modal-icon-btn"
                    onClick={() => setModalFaq(null)}
                    aria-label="Close"
                  >
                    <FiX size={20} />
                  </button>
                </div>
              </div>

              <div className="student-faq-modal-body">
                {modalAnswerSegments.map((seg, idx) => {
                  if (seg.type === "list") {
                    return (
                      <ul key={`list-${idx}`} className="student-faq-modal-checklist">
                        {seg.items.map((item, j) => (
                          <li key={j} className="student-faq-modal-checkitem">
                            <span className="student-faq-modal-check-icon" aria-hidden="true">
                              <FiCheck strokeWidth={3} size={14} />
                            </span>
                            <span className="student-faq-modal-checktext">{item}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <p key={`p-${idx}`} className="student-faq-modal-para">
                      {seg.text}
                    </p>
                  );
                })}
              </div>

             
            </div>
            </div>
          </div>
        )}
      </div>
    </StudentDashboardSectionPage>
  );
}

