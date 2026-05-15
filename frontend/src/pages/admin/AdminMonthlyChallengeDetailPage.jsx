import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCalendar } from 'react-icons/fi';
import DashboardSectionPage from './DashboardSectionPage';

const WEEK_OPTIONS = [1, 2, 3, 4, 5];

function authJsonHeaders() {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function CoursePlacementRow({ monthKey, course, apiBaseUrl, navigate, onUpdated }) {
  const cid = Number(course.id);
  const meta = course.monthly_challenge;
  const source = meta?.source === 'placement' ? 'placement' : 'natural';
  const currentWeek = Number(meta?.week) || 1;
  const [pickWeek, setPickWeek] = useState(String(currentWeek));
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    setBusy(true);
    try {
      await fn();
      await onUpdated();
    } catch (e) {
      window.alert(e.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const putWeek = (week_index) =>
    run(async () => {
      const res = await fetch(
        `${apiBaseUrl}/api/monthly-challenge-months/${encodeURIComponent(monthKey)}/courses/${cid}/placement`,
        { method: 'PUT', headers: authJsonHeaders(), body: JSON.stringify({ week_index }) },
      );
      const payload = await res.json();
      if (!res.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to update week.');
      }
    });

  const clearPlacement = () =>
    run(async () => {
      const res = await fetch(
        `${apiBaseUrl}/api/monthly-challenge-months/${encodeURIComponent(monthKey)}/courses/${cid}/placement`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } },
      );
      const payload = await res.json();
      if (!res.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to clear placement.');
      }
    });

  useEffect(() => {
    setPickWeek(String(currentWeek));
  }, [currentWeek, cid]);

  return (
    <tr>
      <td className="align-middle">
        <div className="fw-semibold text-dark text-truncate" style={{ maxWidth: '14rem' }} title={course.title}>
          {course.title || 'Untitled course'}
        </div>
        <div className="small text-muted">ID {cid}</div>
      </td>
      <td className="align-middle">
        <span
          className={`badge rounded-pill ${source === 'placement' ? 'text-bg-primary' : 'text-bg-secondary'}`}
        >
          {source === 'placement' ? 'Custom week' : 'Upload week'}
        </span>
      </td>
      <td className="align-middle text-nowrap">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <select
            className="form-select form-select-sm admin-mcm-input admin-mcm-input--sm"
            style={{ width: '7rem' }}
            value={pickWeek}
            onChange={(e) => setPickWeek(e.target.value)}
            disabled={busy}
            aria-label="Target week"
          >
            {WEEK_OPTIONS.map((w) => (
              <option key={w} value={String(w)}>
                Week {w}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-sm admin-mcm-btn-save"
            disabled={busy || Number(pickWeek) === currentWeek}
            onClick={() => putWeek(Number(pickWeek))}
          >
            Move
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => putWeek(0)}>
            Hide
          </button>
          {source === 'placement' ? (
            <button type="button" className="btn btn-sm btn-link px-1" disabled={busy} onClick={clearPlacement}>
              Clear override
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export default function AdminMonthlyChallengeDetailPage() {
  const navigate = useNavigate();
  const { monthKey: rawMonth } = useParams();
  const monthKey = useMemo(() => {
    const s = String(rawMonth || '').trim();
    return /^\d{4}-\d{2}$/.test(s) ? s : null;
  }, [rawMonth]);

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addCourseId, setAddCourseId] = useState('');
  const [addWeek, setAddWeek] = useState('1');

  const load = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    if (!monthKey) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/monthly-challenge-months/${encodeURIComponent(monthKey)}/admin-detail`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const payload = await res.json();
      if (res.status === 403) {
        throw new Error(payload.message || 'You do not have access to manage placements.');
      }
      if (!res.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to load month detail.');
      }
      setDetail(payload.data);
    } catch (e) {
      setError(e.message || 'Unable to load.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, monthKey, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddCourse = async () => {
    const id = Number(addCourseId);
    const w = Number(addWeek);
    if (!id || !WEEK_OPTIONS.includes(w)) {
      setError('Pick a course and a week.');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    setError('');
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/monthly-challenge-months/${encodeURIComponent(monthKey)}/courses/${id}/placement`,
        { method: 'PUT', headers: authJsonHeaders(), body: JSON.stringify({ week_index: w }) },
      );
      const payload = await res.json();
      if (!res.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to add course.');
      }
      setAddCourseId('');
      await load();
    } catch (e) {
      setError(e.message || 'Add failed.');
    }
  };

  if (!monthKey) {
    return (
      <DashboardSectionPage title="Monthly Challenges">
        <div className="admin-mcm-page">
          <div className="admin-mcm-page-inner">
            <p className="text-danger mb-0">Invalid month in URL. Use YYYY-MM (example: 2026-05).</p>
            <Link to="/dashboard/monthly-challenges-management" className="btn btn-link px-0">
              Back to month names
            </Link>
          </div>
        </div>
      </DashboardSectionPage>
    );
  }

  const title = detail?.display_name?.trim() || monthKey;

  return (
    <DashboardSectionPage title="Monthly Challenges">
      <div className="admin-mcm-page">
        <div className="admin-mcm-page-inner">
          <header className="admin-mcm-hero lms-card">
            <Link
              to="/dashboard/monthly-challenges-management"
              className="d-inline-flex align-items-center gap-2 small text-decoration-none mb-3 admin-mcm-back-link"
            >
              <FiArrowLeft aria-hidden />
              Month names &amp; list
            </Link>
            <p className="admin-mcm-eyebrow">Welcome &amp; learning</p>
            <h1 className="admin-mcm-title">
              <span className="admin-mcm-title-icon" aria-hidden>
                <FiCalendar />
              </span>
              <span className="admin-mcm-title-text">{title}</span>
            </h1>
            <p className="admin-mcm-lead mb-0">
              Monthly challenges are grouped by <strong>course</strong> upload week (7-day buckets). Videos stay
              inside each course. Move a course to another week, hide it for this month only, or add a course from
              another month into a week. <strong>Clear override</strong> restores the default from the course upload
              date.
            </p>
          </header>

          {error ? (
            <div className="alert alert-danger admin-mcm-alert admin-mcm-alert--danger border-0 py-2 px-3" role="alert">
              {error}
            </div>
          ) : null}

          <section className="admin-mcm-panel lms-card">
            <div className="admin-mcm-panel-head">
              <h2 className="admin-mcm-panel-title">Add a course to this month</h2>
            </div>
            <p className="admin-mcm-panel-desc">
              Pick any org course that is not already listed below or hidden, then choose the week bucket it should
              appear under.
            </p>
            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-6">
                <label className="admin-mcm-label" htmlFor="mcm-add-course">
                  Course
                </label>
                <select
                  id="mcm-add-course"
                  className="form-select admin-mcm-input"
                  value={addCourseId}
                  onChange={(e) => setAddCourseId(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select course…</option>
                  {(detail?.add_pool || []).map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-3">
                <label className="admin-mcm-label" htmlFor="mcm-add-week">
                  Week
                </label>
                <select
                  id="mcm-add-week"
                  className="form-select admin-mcm-input"
                  value={addWeek}
                  onChange={(e) => setAddWeek(e.target.value)}
                  disabled={loading}
                >
                  {WEEK_OPTIONS.map((w) => (
                    <option key={w} value={String(w)}>
                      Week {w}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-3">
                <button
                  type="button"
                  className="btn admin-mcm-btn-primary w-100"
                  disabled={loading || !addCourseId}
                  onClick={handleAddCourse}
                >
                  Add to week
                </button>
              </div>
            </div>
            {!loading && detail && (!detail.add_pool || detail.add_pool.length === 0) ? (
              <p className="small text-muted mb-0 mt-3">No remaining courses to add — all are placed or hidden.</p>
            ) : null}
          </section>

          {loading ? (
            <p className="text-muted">Loading…</p>
          ) : (
            <>
              {WEEK_OPTIONS.map((w) => {
                const rows = (detail?.weeks && detail.weeks[w]) || [];
                return (
                  <section key={w} className="admin-mcm-panel lms-card admin-mcm-detail-week">
                    <div className="admin-mcm-panel-head admin-mcm-panel-head--flush admin-mcm-detail-week-head">
                      <h2 className="admin-mcm-panel-title mb-0">Week {w}</h2>
                      <span className="admin-mcm-panel-badge">{rows.length} course{rows.length === 1 ? '' : 's'}</span>
                    </div>
                    {rows.length === 0 ? (
                      <p className="admin-mcm-empty mb-0 px-3 py-4 px-md-4">No courses in this week.</p>
                    ) : (
                      <div className="admin-mcm-table-wrap admin-mcm-detail-table-wrap">
                        <table className="admin-mcm-table mb-0">
                          <thead>
                            <tr>
                              <th scope="col">Course</th>
                              <th scope="col">Placement</th>
                              <th scope="col">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((course) => (
                              <CoursePlacementRow
                                key={course.id}
                                monthKey={monthKey}
                                course={course}
                                apiBaseUrl={apiBaseUrl}
                                navigate={navigate}
                                onUpdated={load}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                );
              })}

              {detail?.hidden?.length ? (
                <section className="admin-mcm-panel lms-card border-danger border-opacity-25">
                  <div className="admin-mcm-panel-head">
                    <h2 className="admin-mcm-panel-title">Hidden this month</h2>
                    <span className="badge rounded-pill border border-danger text-danger bg-white">
                      {detail.hidden.length}
                    </span>
                  </div>
                  <p className="admin-mcm-panel-desc">
                    These courses are excluded from the student Monthly Challenges view for {monthKey}. Restore by
                    clearing the placement or moving to a week.
                  </p>
                  <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
                    {detail.hidden.map(({ course }) => (
                      <li
                        key={course.id}
                        className="d-flex flex-wrap align-items-center justify-content-between gap-2 border rounded-3 px-3 py-2 bg-light"
                      >
                        <span className="fw-semibold text-truncate" style={{ maxWidth: '20rem' }}>
                          {course.title || 'Untitled'} <span className="text-muted fw-normal">(ID {course.id})</span>
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm admin-mcm-btn-save"
                          onClick={async () => {
                            const token = localStorage.getItem('token');
                            if (!token) return;
                            const res = await fetch(
                              `${apiBaseUrl}/api/monthly-challenge-months/${encodeURIComponent(monthKey)}/courses/${Number(course.id)}/placement`,
                              { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
                            );
                            const payload = await res.json();
                            if (!res.ok || payload.status !== 'success') {
                              window.alert(payload.message || 'Failed');
                              return;
                            }
                            load();
                          }}
                        >
                          Restore (clear hide)
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </DashboardSectionPage>
  );
}
