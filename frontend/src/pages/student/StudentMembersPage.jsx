import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";

export default function StudentMembersPage() {
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || "http://localhost:5003").replace(/\/$/, ""),
    [],
  );

  const fetchMembers = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      return;
    }
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/users/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to fetch students.");
      }
      setMembers(Array.isArray(payload.data) ? payload.data : []);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to fetch students.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchMembers, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchMembers]);

  const filteredMembers = members.filter((member) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      String(member.name || "").toLowerCase().includes(q) ||
      String(member.email || "").toLowerCase().includes(q)
    );
  });

  return (
    <StudentDashboardSectionPage title="Students">
      <div className="container-fluid px-0" style={{ maxWidth: 1240 }}>
        <section className="student-members-page lms-card">
          <div className="student-members-modal-top">
            <h2 className="student-members-title mb-0">students</h2>
            <small className="text-muted">Show map</small>
          </div>
          <div className="student-members-grid">
            <aside className="student-members-left">
              <div className="student-members-profile-card">
                <div className="student-members-avatar">
                  {String(filteredMembers[0]?.name || "S").trim().charAt(0).toUpperCase()}
                </div>
                <h3 className="h6 fw-bold mb-1">{filteredMembers[0]?.name || "Student"}</h3>
                <p className="text-muted small mb-3">{filteredMembers[0]?.email || "Community student"}</p>
                <button type="button" className="btn btn-primary btn-sm rounded-pill px-3">
                  View profile
                </button>
              </div>
              <div className="student-members-filter-card">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h4 className="h6 fw-semibold mb-0">Find students</h4>
                  <button type="button" className="btn btn-link btn-sm text-decoration-none p-0" onClick={() => setSearchTerm("")}>
                    Clear all
                  </button>
                </div>
                <input
                  className="form-control form-control-sm mb-2"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                <div className="d-flex flex-wrap gap-2">
                  <span className="badge text-bg-light">Near me</span>
                  <span className="badge text-bg-light">Online</span>
                  <span className="badge text-bg-light">Recently joined</span>
                </div>
              </div>
            </aside>
            <div className="student-members-right">
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <div className="d-flex align-items-baseline gap-2 mb-3">
                <h4 className="h5 fw-semibold mb-0">Search results</h4>
                <small className="text-muted">{filteredMembers.length}</small>
              </div>
              <div className="student-members-list">
                {isLoading ? (
                  <p className="text-muted mb-0">Loading students...</p>
                ) : filteredMembers.length === 0 ? (
                  <p className="text-muted mb-0">No students found.</p>
                ) : (
                  filteredMembers.map((member) => (
                    <article key={member.id} className="student-member-row">
                      <div className="student-member-row-avatar">
                        {String(member.name || "S").trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-grow-1">
                        <h5 className="h6 mb-1 fw-semibold">{member.name || "Student"}</h5>
                        <p className="mb-0 text-muted small">{member.email || "Student member"}</p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                        onClick={() => navigate(`/dashboard/student-messages?memberId=${member.id}`)}
                      >
                        Message
                      </button>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </StudentDashboardSectionPage>
  );
}

