import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import { useNavigate } from "react-router-dom";
import { FiCalendar, FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import DashboardSectionPage from "./DashboardSectionPage";

const initialForm = {
  title: "",
  event_date: "",
  time_label: "",
  sort_order: 0,
  is_active: true,
};

export default function UpcomingEventsManagementPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const fetchEvents = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/upcoming-events?include_inactive=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to load upcoming events.");
      }
      setEvents(Array.isArray(payload.data) ? payload.data : []);
    } catch (e) {
      setError(e.message || "Unable to load upcoming events.");
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, navigate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const openCreate = () => {
    setEditId(null);
    setForm(initialForm);
    setShowModal(true);
    setError("");
  };

  const openEdit = (event) => {
    setEditId(event.id);
    setForm({
      title: event.title || "",
      event_date: event.event_date || "",
      time_label: event.time_label || event.time || "",
      sort_order: Number(event.sort_order || 0),
      is_active: event.is_active !== false,
    });
    setShowModal(true);
    setError("");
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setShowModal(false);
    setEditId(null);
    setForm(initialForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    if (!String(form.title || "").trim()) {
      setError("Title is required.");
      return;
    }
    if (!String(form.event_date || "").trim()) {
      setError("Event date is required.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setNotice("");
    try {
      const body = {
        title: form.title.trim(),
        event_date: form.event_date,
        time_label: form.time_label.trim(),
        sort_order: Number(form.sort_order || 0),
        is_active: Boolean(form.is_active),
      };
      const response = await fetch(
        editId
          ? `${apiBaseUrl}/api/upcoming-events/${editId}`
          : `${apiBaseUrl}/api/upcoming-events`,
        {
          method: editId ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to save event.");
      }
      setNotice(editId ? "Event updated." : "Event created.");
      setShowModal(false);
      setEditId(null);
      setForm(initialForm);
      await fetchEvents();
    } catch (err) {
      setError(err.message || "Unable to save event.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (event) => {
    if (!window.confirm(`Delete “${event.title}”?`)) return;
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/upcoming-events/${event.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to delete event.");
      }
      setNotice("Event deleted.");
      await fetchEvents();
    } catch (err) {
      setError(err.message || "Unable to delete event.");
    }
  };

  const activeCount = events.filter((ev) => ev.is_active).length;

  return (
    <DashboardSectionPage title="Upcoming Events">
      <div className="container-fluid px-0" style={{ maxWidth: 1100 }}>
        <div
          className="lms-card p-4 p-md-5 mb-3 text-white border-0"
          style={{
            background: "linear-gradient(120deg,#1e1b4b,#312e81 45%,#4c1d95)",
            boxShadow: "0 18px 45px rgba(49,46,129,0.35)",
          }}
        >
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div>
              <p className="small text-uppercase text-white-50 mb-1" style={{ letterSpacing: "0.06em" }}>
                Feed sidebar
              </p>
              <h1 className="h2 fw-bold mb-2">Upcoming Events</h1>
              <p className="mb-0 text-light" style={{ maxWidth: 540 }}>
                Create and manage events shown in the right rail on the community Feed page.
              </p>
              {!isLoading && events.length > 0 && (
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <span className="badge rounded-pill px-3 py-2" style={{ background: "rgba(255,255,255,0.18)" }}>
                    {events.length} total
                  </span>
                  <span className="badge rounded-pill px-3 py-2" style={{ background: "rgba(34,197,94,0.35)" }}>
                    {activeCount} active
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-light rounded-pill px-4 fw-semibold d-inline-flex align-items-center gap-2"
              onClick={openCreate}
            >
              <FiPlus size={18} aria-hidden />
              Add event
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
        {notice && <div className="alert alert-success py-2 mb-3">{notice}</div>}

        <div className="lms-card p-0 overflow-hidden">
          <div className="px-3 px-md-4 py-3 border-bottom bg-light bg-opacity-50">
            <h2 className="h5 fw-semibold mb-0">All events</h2>
          </div>
          <div className="p-3 p-md-4">
            {isLoading ? (
              <p className="text-muted mb-0">Loading events…</p>
            ) : events.length === 0 ? (
              <div className="text-center text-muted py-5">
                <FiCalendar className="mb-3 opacity-50" size={40} aria-hidden />
                <p className="mb-1 fw-semibold text-dark">No upcoming events yet</p>
                <p className="mb-3 small">Add your first event to show it on the Feed sidebar.</p>
                <button type="button" className="btn btn-primary rounded-pill px-4" onClick={openCreate}>
                  Add event
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Title</th>
                      <th>Time</th>
                      <th>Order</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id}>
                        <td>
                          <div className="student-community-event-date d-inline-flex flex-column align-items-center justify-content-center">
                            <strong>{event.day}</strong>
                            <span>{event.month}</span>
                          </div>
                        </td>
                        <td className="fw-semibold">{event.title}</td>
                        <td className="text-muted">{event.time_label || "—"}</td>
                        <td>{event.sort_order}</td>
                        <td>
                          <span className={`badge ${event.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                            {event.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-end">
                          <div className="d-inline-flex gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => openEdit(event)}
                              title="Edit"
                            >
                              <FiEdit2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(event)}
                              title="Delete"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal ? (
        <div className="modal show d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(15,23,42,0.45)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h2 className="modal-title h5 mb-0">{editId ? "Edit event" : "Add event"}</h2>
                <button type="button" className="btn btn-sm btn-light" onClick={closeModal} aria-label="Close">
                  <FiX />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body d-flex flex-column gap-3">
                  <div>
                    <label className="form-label" htmlFor="ue-title">
                      Title
                    </label>
                    <input
                      id="ue-title"
                      className="form-control"
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="LIVE with Ryan Serhant"
                      required
                    />
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="ue-date">
                        Event date
                      </label>
                      <input
                        id="ue-date"
                        type="date"
                        className="form-control"
                        value={form.event_date}
                        onChange={(e) => setForm((p) => ({ ...p, event_date: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="ue-order">
                        Sort order
                      </label>
                      <input
                        id="ue-order"
                        type="number"
                        className="form-control"
                        value={form.sort_order}
                        onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="ue-time">
                      Time label
                    </label>
                    <input
                      id="ue-time"
                      className="form-control"
                      value={form.time_label}
                      onChange={(e) => setForm((p) => ({ ...p, time_label: e.target.value }))}
                      placeholder="12:30 - 1:00 AM IST"
                    />
                  </div>
                  <div className="form-check">
                    <input
                      id="ue-active"
                      type="checkbox"
                      className="form-check-input"
                      checked={form.is_active}
                      onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                    />
                    <label className="form-check-label" htmlFor="ue-active">
                      Active (visible on Feed)
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={closeModal} disabled={isSubmitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? "Saving…" : editId ? "Save changes" : "Create event"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardSectionPage>
  );
}
