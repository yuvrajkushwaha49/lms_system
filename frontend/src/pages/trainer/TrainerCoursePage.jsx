import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TrainerDashboardSectionPage from './TrainerDashboardSectionPage';

export default function TrainerCoursePage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [videoCounts, setVideoCounts] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5003').replace(/\/$/, ''),
    [],
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session missing. Please login first.');
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
          throw new Error(payload.message || 'Unable to fetch courses');
        }
        const fetchedCourses = payload.data || [];
        setCourses(fetchedCourses);

        const countEntries = await Promise.all(
          fetchedCourses.map(async (course) => {
            try {
              const videosResponse = await fetch(`${apiBaseUrl}/api/courses/${course.id}/videos`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const videosPayload = await videosResponse.json();
              if (!videosResponse.ok || videosPayload.status !== 'success') {
                return [String(course.id), 0];
              }
              return [String(course.id), (videosPayload.data || []).length];
            } catch {
              return [String(course.id), 0];
            }
          }),
        );
        setVideoCounts(Object.fromEntries(countEntries));
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, [apiBaseUrl]);

  const isShortCourse = (course) => {
    const courseType = String(course?.course_type || '').toLowerCase();
    const recordedType = String(course?.recorded_type || '').toLowerCase();
    return courseType.includes('short') || recordedType.includes('short');
  };

  const shortCoursesCount = courses.filter((course) => isShortCourse(course)).length;
  const liveCoursesCount = courses.filter((course) => String(course.delivery_mode || '').toLowerCase() === 'live').length;
  const filteredCourses = useMemo(() => {
    const base = activeTab === 'short' ? courses.filter((course) => isShortCourse(course)) : courses;
    const query = searchTerm.trim().toLowerCase();
    if (!query) return base;
    return base.filter((course) => {
      const source = `${course.title || ''} ${course.description || ''} ${course.delivery_mode || ''} ${course.pricing_type || ''} ${course.course_type || ''}`.toLowerCase();
      return source.includes(query);
    });
  }, [activeTab, courses, searchTerm]);

  return (
    <TrainerDashboardSectionPage title="Trainer Course">
      <div className="container-fluid px-0" style={{ maxWidth: 1200 }}>
        <div className="lms-card p-4 p-md-5 mb-3 text-white" style={{ background: 'linear-gradient(90deg,#071d3d,#0d2f69 45%,#0a5dea)' }}>
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
            <div>
              <p className="text-uppercase small mb-1 text-light">Trainer Workspace</p>
              <h1 className="h2 fw-bold mb-1">Trainer Course Panel</h1>
              <p className="mb-0 text-light">Review assigned courses and open detail page for videos and lessons.</p>
            </div>
            <span className="badge bg-light text-dark fs-6">{filteredCourses.length} records</span>
          </div>
        </div>

        {error && <div className="alert alert-danger mb-3">{error}</div>}

        <div className="lms-card p-3 p-md-4 mb-3">
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <div className="border rounded-3 p-3 h-100">
                <p className="mb-1 text-uppercase small text-muted">All Courses</p>
                <h3 className="h5 mb-0">{courses.length}</h3>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="border rounded-3 p-3 h-100">
                <p className="mb-1 text-uppercase small text-muted">Short Courses</p>
                <h3 className="h5 mb-0">{shortCoursesCount}</h3>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="border rounded-3 p-3 h-100">
                <p className="mb-1 text-uppercase small text-muted">Live Courses</p>
                <h3 className="h5 mb-0">{liveCoursesCount}</h3>
              </div>
            </div>
          </div>
        </div>

        <div className="lms-card p-0 mb-3 overflow-hidden">
          <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="btn-group student-filter-tabs" role="group" aria-label="Trainer course filter tabs">
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('all')}
              >
                All courses
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'short' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('short')}
              >
                Short courses
              </button>
            </div>
            <div className="small text-muted">
              Short Courses: <strong>{shortCoursesCount}</strong>
            </div>
          </div>
          <div className="px-3 py-3 border-bottom">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by title, type, mode or pricing..."
              className="form-control"
            />
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-4">Course</th>
                  <th>Mode</th>
                  <th>Type</th>
                  <th>Pricing</th>
                  <th>Videos</th>
                  <th className="text-end pe-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-5 text-muted">Loading courses...</td>
                  </tr>
                ) : filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-5 text-muted">
                      {activeTab === 'short' ? 'No short courses found.' : 'No courses found.'}
                    </td>
                  </tr>
                ) : (
                  filteredCourses.map((course) => (
                    <tr key={course.id}>
                      <td className="ps-4 fw-semibold">{course.title || '-'}</td>
                      <td>{course.delivery_mode || '-'}</td>
                      <td>{course.course_type || course.recorded_type || '-'}</td>
                      <td>{course.pricing_type || (Number(course.price) === 0 ? 'Free for Members' : 'Paid')}</td>
                      <td>{videoCounts[String(course.id)] ?? 0}</td>
                      <td className="text-end pe-4">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => navigate(`/dashboard/trainer-course/${course.id}`)}
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
    </TrainerDashboardSectionPage>
  );
}

