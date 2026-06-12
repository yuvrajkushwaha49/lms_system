import { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { useNavigate } from 'react-router-dom';
import DashboardSectionPage from './DashboardSectionPage';

export default function MemberManagementPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session missing. Please login first.');
      navigate('/login');
      return;
    }

    try {
      setIsLoadingUsers(true);
      const response = await fetch(`${apiBaseUrl}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        throw new Error('Session expired or unauthorized. Please login again.');
      }
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Failed to fetch users');
      }
      const memberUsers = (payload.data || []).filter(
        (user) => (user.role || '').toLowerCase() === 'student',
      );
      setUsers(memberUsers);
    } catch (fetchError) {
      setError(fetchError.message);
      if (/unauthorized|session/i.test(fetchError.message)) {
        navigate('/login');
      }
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setFeedback('');
    setError('');

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please login from API first. Token not found in localStorage.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role_name: 'Student',
        }),
      });
      const payload = await response.json();
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        throw new Error('Session expired or unauthorized. Please login again.');
      }
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to create member');
      }

      setFeedback('Member created successfully.');
      setFormData({ name: '', email: '', phone: '', password: '' });
      setShowModal(false);
      await fetchUsers();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const source = `${user.name || ''} ${user.email || ''} ${user.phone || ''} ${user.role || ''}`.toLowerCase();
    return source.includes(searchTerm.toLowerCase());
  });

  const formatDate = (input) => {
    if (!input) return '-';
    return new Date(input).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <DashboardSectionPage title="Member Management">
      <div className="container-fluid px-0"  >
        <div className="lms-card p-4 p-md-5 mb-3 text-white" style={{ background: 'linear-gradient(90deg,#071d3d,#0d2f69 45%,#0a5dea)' }}>
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
            <div>
              <p className="text-uppercase small mb-1 text-light">People Hub</p>
              <h1 className="h2 fw-bold mb-1">Member Management</h1>
              <p className="mb-0 text-light">Manage members, roles, and account status.</p>
            </div>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-light text-dark fs-6">{filteredUsers.length} records</span>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setFeedback('');
                  setShowModal(true);
                }}
                className="btn btn-warning fw-bold"
              >
                  + Add member
              </button>
            </div>
          </div>
        </div>

        {(feedback || error) && (
          <div className={`alert ${error ? 'alert-danger' : 'alert-success'} mb-3`}>
            {error || feedback}
          </div>
        )}

        <div className="lms-card p-3 p-md-4 mb-3">
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
            <div className="w-100" style={{ maxWidth: 520 }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, email, phone, role, status..."
                className="form-control form-control-lg"
              />
            </div>
            <small className="text-muted">
              Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong>
            </small>
          </div>
        </div>

        <div className="lms-card p-0 mb-3 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-4">Name</th>
                  <th className="d-none d-md-table-cell">Email</th>
                  <th className="d-none d-lg-table-cell">Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="d-none d-md-table-cell">Added on</th>
                  <th className="text-end pe-4">Details</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingUsers ? (
                  <tr>
                    <td colSpan={7} className="text-center py-5 text-muted">Loading users...</td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-5 text-muted">No users found.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={`${user.id}-${user.email}`}>
                      <td className="ps-4 fw-semibold">{user.name || '-'}</td>
                      <td className="d-none d-md-table-cell">{user.email || '-'}</td>
                      <td className="d-none d-lg-table-cell">{user.phone || '-'}</td>
                      <td><span className="badge text-bg-info">{user.role || 'Student'}</span></td>
                      <td><span className="badge text-bg-success text-uppercase">{user.status || 'active'}</span></td>
                      <td className="d-none d-md-table-cell">{formatDate(user.created_at)}</td>
                      <td className="text-end pe-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/user-management/${user.id}`)}
                          className="btn btn-outline-primary btn-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(15,23,42,0.45)', zIndex: 1200 }}>
            <div className="card shadow-lg border-0" style={{ width: '100%', maxWidth: 520, borderRadius: 18 }}>
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                      <h2 className="h4 mb-1">Add member</h2>
                    <p className="text-muted mb-0 small">New members are created with Member role only.</p>
                  </div>
                  <button type="button" className="btn btn-sm btn-light" onClick={() => setShowModal(false)}>x</button>
                </div>
                <form onSubmit={handleCreateUser}>
                  <div className="mb-3">
                    <label className="form-label">Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required className="form-control" placeholder="Full name" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} required className="form-control" placeholder="name@company.com" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Phone</label>
                    <input type="text" name="phone" value={formData.phone} onChange={handleChange} required className="form-control" placeholder="9876543210" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input type="password" name="password" value={formData.password} onChange={handleChange} required className="form-control" placeholder="Temporary password" />
                  </div>
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline-secondary">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                      {isSubmitting ? 'Creating...' : 'Create member'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardSectionPage>
  );
}

