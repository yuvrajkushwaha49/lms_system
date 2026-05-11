import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";

export default function StudentFaqsPage() {
  const [faqs, setFaqs] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || "http://localhost:5003").replace(/\/$/, ""),
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
      if (rows.length) {
        setOpenId(Number(rows[0].id));
      }
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

  return (
    <StudentDashboardSectionPage title="FAQs">
      <div className="container-fluid px-0 student-faq-page-wrap" style={{ maxWidth: 1100 }}>
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

        <section className="student-faq-hero">
          <div className="student-faq-hero-copy">
            <p className="student-faq-kicker mb-2">Sell It Starter</p>
            <h1 className="student-faq-title mb-3">
              FREQUENTLY ASKED
              <br />
              <span>QUESTIONS</span>
            </h1>
            <p className="student-faq-subtitle mb-0">
              Everything you need to know about becoming a member and what&apos;s waiting for you inside.
            </p>
          </div>
          <div className="student-faq-hero-media" aria-hidden="true">
            <div className="student-faq-hero-glow" />
          </div>
        </section>

        <section className="student-faq-list-card">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          {isLoading ? (
            <p className="text-muted mb-0">Loading FAQs...</p>
          ) : faqs.length === 0 ? (
            <p className="text-muted mb-0">No FAQs available yet.</p>
          ) : (
            <div className="student-faq-list">
              {faqs.map((faq) => {
                const isOpen = Number(openId) === Number(faq.id);
                return (
                  <div key={faq.id} className={`student-faq-item ${isOpen ? "open" : ""}`}>
                    <button
                      type="button"
                      className="student-faq-question"
                      onClick={() => setOpenId((prev) => (Number(prev) === Number(faq.id) ? null : Number(faq.id)))}
                    >
                      <span className="student-faq-question-left">→ {faq.question}</span>
                      <span className="student-faq-question-right">{isOpen ? "−" : "···"}</span>
                    </button>
                    {isOpen && <div className="student-faq-answer">{faq.answer}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </StudentDashboardSectionPage>
  );
}

