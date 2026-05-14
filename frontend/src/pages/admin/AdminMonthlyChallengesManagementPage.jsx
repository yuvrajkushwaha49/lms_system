import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiPlus, FiRotateCcw } from 'react-icons/fi';
import DashboardSectionPage from './DashboardSectionPage';

const emptyDraft = () => ({ month_key: '', display_name: '' });

export default function AdminMonthlyChallengesManagementPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5003').replace(/\/$/, ''),
    [],
  );

  const load = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      setIsLoading(true);
      setError('');
      const response = await fetch(`${apiBaseUrl}/api/monthly-challenge-months`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to load monthly challenge names.');
      }
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (e) {
      setError(e.message || 'Unable to load monthly challenge names.');
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => String(b.month_key).localeCompare(String(a.month_key))),
    [rows],
  );

  const showNotice = (msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 3500);
  };

  const saveEntry = async (month_key, display_name) => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return false;
    }
    setIsSaving(true);
    setError('');
    try {
      const response = await fetch(`${apiBaseUrl}/api/monthly-challenge-months`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ month_key, display_name }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Save failed.');
      }
      await load();
      showNotice('Saved.');
      return true;
    } catch (e) {
      setError(e.message || 'Save failed.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    const mk = String(draft.month_key || '').trim();
    const name = String(draft.display_name || '').trim();
    if (!mk || !name) {
      setError('Pick a month and enter a display name.');
      return;
    }
    const ok = await saveEntry(mk, name);
    if (ok) setDraft(emptyDraft());
  };

  const handleSaveRow = async (month_key) => {
    const name = String(editing[month_key] ?? '').trim();
    if (!name) {
      setError('Display name cannot be empty.');
      return;
    }
    const ok = await saveEntry(month_key, name);
    if (ok) {
      setEditing((prev) => {
        const next = { ...prev };
        delete next[month_key];
        return next;
      });
    }
  };

  const handleDelete = async (month_key) => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    if (!window.confirm(`Reset "${month_key}" to the default calendar name (e.g. May 2025)?`)) {
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/monthly-challenge-months/${encodeURIComponent(month_key)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Delete failed.');
      }
      await load();
      showNotice('Reset to default name.');
    } catch (e) {
      setError(e.message || 'Delete failed.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardSectionPage title="Monthly Challenges">
      <div className="admin-mcm-page">
        <div className="admin-mcm-page-inner">
          <header className="admin-mcm-hero lms-card">
            <p className="admin-mcm-eyebrow">Welcome &amp; learning</p>
            <h1 className="admin-mcm-title">
              <span className="admin-mcm-title-icon" aria-hidden>
                <FiCalendar />
              </span>
              <span className="admin-mcm-title-text">
                Monthly Challenges
                <span className="admin-mcm-title-sub"> — month names</span>
              </span>
            </h1>
            <p className="admin-mcm-lead">
              Every month that already has course uploads is <strong>created automatically</strong> with a default
              calendar name (e.g. May 2025). Edit any row to your challenge title. Use reset to put the default
              calendar name back.
            </p>
          </header>

          {notice ? (
            <div className="alert alert-success admin-mcm-alert admin-mcm-alert--success border-0 py-2 px-3" role="status">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="alert alert-danger admin-mcm-alert admin-mcm-alert--danger border-0 py-2 px-3" role="alert">
              {error}
            </div>
          ) : null}

          <section className="admin-mcm-panel lms-card">
            <div className="admin-mcm-panel-head">
              <h2 className="admin-mcm-panel-title">Add a month manually</h2>
              <span className="admin-mcm-panel-badge">Optional</span>
            </div>
            <p className="admin-mcm-panel-desc">
              Upload months are usually filled in for you. Use this only if you need a label before any course is
              uploaded for that month.
            </p>
            <form onSubmit={handleAdd} className="admin-mcm-form">
              <div className="row g-3 g-lg-4 align-items-end">
                <div className="col-12 col-lg-4">
                  <label className="admin-mcm-label" htmlFor="mcm-month">
                    Calendar month
                  </label>
                  <input
                    id="mcm-month"
                    type="month"
                    className="form-control admin-mcm-input"
                    value={draft.month_key}
                    onChange={(e) => setDraft((d) => ({ ...d, month_key: e.target.value }))}
                    required
                  />
                </div>
                <div className="col-12 col-lg-5">
                  <label className="admin-mcm-label" htmlFor="mcm-name">
                    Challenge / display name
                  </label>
                  <input
                    id="mcm-name"
                    type="text"
                    className="form-control admin-mcm-input"
                    placeholder="e.g. May | The Sell It Pipeline Operating System"
                    maxLength={255}
                    value={draft.display_name}
                    onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="col-12 col-lg-3">
                  <button
                    type="submit"
                    className="btn admin-mcm-btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-2"
                    disabled={isSaving}
                  >
                    <FiPlus aria-hidden />
                    Save month
                  </button>
                </div>
              </div>
            </form>
          </section>

          <section className="admin-mcm-panel lms-card admin-mcm-panel--table">
            <div className="admin-mcm-panel-head admin-mcm-panel-head--flush">
              <h2 className="admin-mcm-panel-title mb-0">Configured months</h2>
            </div>
            {isLoading ? (
              <p className="admin-mcm-empty mb-0">Loading…</p>
            ) : sortedRows.length === 0 ? (
              <div className="admin-mcm-empty-callout">
                <p className="admin-mcm-empty-title mb-1">No months yet</p>
                <p className="admin-mcm-empty mb-0">
                  When courses exist, months appear here automatically — open this page again after adding courses.
                </p>
              </div>
            ) : (
              <div className="admin-mcm-table-wrap">
                <table className="admin-mcm-table">
                  <thead>
                    <tr>
                      <th scope="col">Month (YYYY-MM)</th>
                      <th scope="col">Display name</th>
                      <th scope="col" className="admin-mcm-th-actions">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => {
                      const mk = row.month_key;
                      const local = editing[mk] !== undefined ? editing[mk] : row.display_name;
                      const dirty = String(local).trim() !== String(row.display_name || '').trim();
                      return (
                        <tr key={mk}>
                          <td>
                            <code className="admin-mcm-month-key">{mk}</code>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control form-control-sm admin-mcm-input admin-mcm-input--sm"
                              maxLength={255}
                              value={local}
                              onChange={(e) => setEditing((prev) => ({ ...prev, [mk]: e.target.value }))}
                            />
                          </td>
                          <td className="admin-mcm-td-actions">
                            <div className="admin-mcm-row-actions">
                              <button
                                type="button"
                                className="btn btn-sm admin-mcm-btn-save"
                                disabled={isSaving || !dirty}
                                onClick={() => handleSaveRow(mk)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm admin-mcm-btn-reset"
                                disabled={isSaving}
                                onClick={() => handleDelete(mk)}
                                title="Reset to default calendar name"
                                aria-label={`Reset ${mk} to default name`}
                              >
                                <FiRotateCcw aria-hidden />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardSectionPage>
  );
}
