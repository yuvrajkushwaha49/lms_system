import { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { useNavigate } from 'react-router-dom';
import DashboardSectionPage from './DashboardSectionPage';

export default function WorkshopManagementPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session missing. Please login first.');
      navigate('/login');
      return;
    }
    const fetchCourses = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${apiBaseUrl}/api/courses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') {
          throw new Error(payload.message || 'Unable to fetch workshops');
        }
        setCourses(payload.data || []);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourses();
  }, [apiBaseUrl, navigate]);

  const workshopCourses = useMemo(
    () =>
      courses.filter((course) => {
        const courseType = String(course.course_type || '').toLowerCase();
        const deliveryMode = String(course.delivery_mode || '').toLowerCase();
        return courseType.includes('workshop') || deliveryMode === 'live';
      }),
    [courses],
  );

  const filteredWorkshops = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return workshopCourses;
    return workshopCourses.filter((course) => {
      const source = `${course.title || ''} ${course.description || ''} ${course.pricing_type || ''}`.toLowerCase();
      return source.includes(query);
    });
  }, [workshopCourses, searchTerm]);

  return (
    <DashboardSectionPage title="Workshop Management">
      <div className="container-fluid px-0" style={{ maxWidth: 1200 }}>
        <div className="lms-card p-4 p-md-5 mb-3 text-white" style={{ background: 'linear-gradient(90deg,#071d3d,#0d2f69 45%,#0a5dea)' }}>
          <h1 className="h2 fw-bold mb-1">Workshop Management</h1>
          <p className="mb-0 text-light">Live workshop data from courses table.</p>
        </div>
        {error && <div className="alert alert-danger mb-3">{error}</div>}
        <div className="lms-card p-3 p-md-4 mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search workshop courses..."
            className="form-control form-control-lg"
          />
        </div>
        <div className="lms-card p-0 mb-3 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-4">Title</th>
                  <th>Mode</th>
                  <th>Pricing</th>
                  <th>Description</th>
                  <th className="text-end pe-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-5 text-muted">Loading workshops...</td>
                  </tr>
                ) : filteredWorkshops.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-5 text-muted">No workshop data found.</td>
                  </tr>
                ) : (
                  filteredWorkshops.map((course) => (
                    <tr key={course.id}>
                      <td className="ps-4 fw-semibold">{course.title || '-'}</td>
                      <td>{course.delivery_mode || 'Live'}</td>
                      <td>{course.pricing_type || (Number(course.price) === 0 ? 'Free for Members' : 'Paid')}</td>
                      <td>{course.description || '-'}</td>
                      <td className="text-end pe-4">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => navigate(`/dashboard/course-management/${course.id}`)}
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
      </div>
    </DashboardSectionPage>
  );
}

