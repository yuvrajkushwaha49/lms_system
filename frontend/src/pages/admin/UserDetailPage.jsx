import { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { useNavigate, useParams } from 'react-router-dom';
import DashboardSectionPage from './DashboardSectionPage';

function IconMail() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

export default function UserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(`${apiBaseUrl}/api/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
          return;
        }
        if (!response.ok || payload.status !== 'success') {
          throw new Error(payload.message || 'User not found');
        }
        if (!cancelled) setUser(payload.data);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load user');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, userId, navigate]);

  const initial = user?.name?.trim()?.[0]?.toUpperCase() || '?';
  const statusLabel = (user?.status || 'active').toUpperCase();

  const backButton = <button type="button" onClick={() => navigate('/dashboard/user-management')} className="btn btn-outline-secondary btn-sm">← Back</button>;

  return (
    <DashboardSectionPage>
      <div className="container-fluid px-0" style={{ maxWidth: 980 }}>
        {loading && (
          <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-3">
            {backButton}
            <div className="lms-card p-4 flex-grow-1 text-muted">Loading profile...</div>
          </div>
        )}

        {error && !loading && (
          <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-3">
            {backButton}
            <div className="alert alert-danger mb-0 flex-grow-1">{error}</div>
          </div>
        )}

        {!loading && user && (
          <>
            <div className="lms-card p-4 p-md-5 text-white mb-3" style={{ background: 'linear-gradient(115deg,#3420b8,#1d4ed8,#1e3a8a)' }}>
              <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-3 mb-3">
                {backButton}
                <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center w-100 gap-3">
                  <div className="d-flex align-items-start gap-3">
                    <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold fs-4" style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.22)' }}>
                      {initial}
                    </div>
                    <div>
                      <h1 className="h3 fw-bold mb-2">{user.name || '—'}</h1>
                      <div className="small d-flex align-items-center gap-2 mb-1"><IconMail /> {user.email || '—'}</div>
                      <div className="small d-flex align-items-center gap-2"><IconPhone /> {user.phone || '—'}</div>
                      <div className="small mt-2">Role: <strong>{user.role || '—'}</strong></div>
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <span className="badge text-bg-success">{statusLabel}</span>
                    <span className="badge text-bg-dark">Calls loaded: 0</span>
                    <span className="badge text-bg-primary">Page: 1</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="lms-card p-4 p-md-5">
              <div className="row g-4">
                <div className="col-md">
                  <p className="text-uppercase small text-muted mb-2">Account actions</p>
                  <div className="d-flex flex-wrap gap-2">
                    <button type="button" className="btn btn-warning">Deactivate</button>
                    <button type="button" className="btn btn-outline-primary">Change password</button>
                    <button type="button" className="btn btn-outline-success">Edit details</button>
                    <button type="button" className="btn btn-outline-dark">Device history</button>
                  </div>
                </div>
                <div className="col-md-auto">
                  <p className="text-uppercase small text-danger mb-2">Danger zone</p>
                  <button type="button" className="btn btn-danger">Delete user</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardSectionPage>
  );
}

