import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardSectionPage from './DashboardSectionPage';

export default function CourseManagementPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    deliveryMode: 'Recorded',
    recordedType: 'Chapter Wise/Topic Wise',
    pricingType: 'Paid',
    courseType: 'Chapter Wise Course',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [courses, setCourses] = useState([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5003').replace(/\/$/, ''),
    [],
  );

  const fetchCourses = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session missing. Please login first.');
      navigate('/login');
      return;
    }

    try {
      setIsLoadingCourses(true);
      const response = await fetch(`${apiBaseUrl}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        throw new Error('Session expired or unauthorized. Please login again.');
      }

      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Failed to fetch courses');
      }

      setCourses(payload.data || []);
    } catch (fetchError) {
      setError(fetchError.message);
      if (/unauthorized|session/i.test(fetchError.message)) {
        navigate('/login');
      }
    } finally {
      setIsLoadingCourses(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => {
      if (name === 'pricingType' && value === 'Free for Members') {
        return { ...prev, pricingType: value, price: '0' };
      }
      if (name === 'courseType') {
        if (value === 'Workshop') {
          return { ...prev, courseType: value, deliveryMode: 'Live', recordedType: 'Chapter Wise/Topic Wise' };
        }
        if (value === 'Short Course') {
          return { ...prev, courseType: value, deliveryMode: 'Recorded', recordedType: 'Short Courses' };
        }
        return { ...prev, courseType: value, deliveryMode: 'Recorded', recordedType: 'Chapter Wise/Topic Wise' };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleCreateCourse = async (event) => {
    event.preventDefault();
    setFeedback('');
    setError('');

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please login from API first. Token not found in localStorage.');
      return;
    }

    const numericPrice = formData.pricingType === 'Free for Members' ? 0 : Number(formData.price);
    if (formData.pricingType === 'Paid' && (Number.isNaN(numericPrice) || numericPrice <= 0)) {
      setError('Please enter a valid paid price greater than 0.');
      return;
    }
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      setError('Please enter a valid non-negative price.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          price: numericPrice,
          delivery_mode: formData.deliveryMode,
          recorded_type: formData.deliveryMode === 'Recorded' ? formData.recordedType : null,
          pricing_type: formData.pricingType,
          free_for_members: formData.pricingType === 'Free for Members',
          course_type: formData.courseType,
        }),
      });

      const payload = await response.json();
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        throw new Error('Session expired or unauthorized. Please login again.');
      }

      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to create course');
      }

      setFeedback('Course created successfully.');
      setFormData({
        title: '',
        description: '',
        price: '',
        deliveryMode: 'Recorded',
        recordedType: 'Chapter Wise/Topic Wise',
        pricingType: 'Paid',
        courseType: 'Chapter Wise Course',
      });
      setShowModal(false);
      await fetchCourses();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sidebarTypeFilter = useMemo(() => {
    const typeParam = new URLSearchParams(location.search).get('type');
    if (typeParam === 'short-courses') return 'short';
    if (typeParam === 'chapter-wise-topic-wise' || typeParam === 'chapter-wise-course') return 'chapter';
    return 'all';
  }, [location.search]);

  const normalizeRecordedType = (value) => String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  const normalizeCourseType = (value) => String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  const isShortCourseType = (value) => normalizeRecordedType(value).includes('shortcourse');
  const isShortByCourseType = (value) => normalizeCourseType(value).includes('shortcourse');
  const isChapterCourseType = (value, deliveryMode) => {
    const normalized = normalizeRecordedType(value);
    if (normalized.includes('chapterwise') || normalized.includes('topicwise')) return true;
    // Backward compatibility: treat older recorded uploads with empty type as chapter-wise.
    return String(deliveryMode || '').toLowerCase() === 'recorded' && !normalized;
  };

  const defaultRecordedTypeBySidebar = useMemo(() => {
    if (sidebarTypeFilter === 'short') return 'Short Courses';
    if (sidebarTypeFilter === 'chapter') return 'Chapter Wise/Topic Wise';
    return 'Chapter Wise/Topic Wise';
  }, [sidebarTypeFilter]);

  const defaultCourseTypeBySidebar = useMemo(() => {
    if (sidebarTypeFilter === 'short') return 'Short Course';
    if (sidebarTypeFilter === 'chapter') return 'Chapter Wise Course';
    return 'Chapter Wise Course';
  }, [sidebarTypeFilter]);

  useEffect(() => {
    // Keep sidebar filter switch predictable by clearing stale search text.
    setSearchTerm('');
  }, [sidebarTypeFilter]);

  useEffect(() => {
    if (!showModal) return;
    if (sidebarTypeFilter !== 'short' && sidebarTypeFilter !== 'chapter') return;
    setFormData((prev) => ({
      ...prev,
      deliveryMode: 'Recorded',
      recordedType: defaultRecordedTypeBySidebar,
      courseType: defaultCourseTypeBySidebar,
    }));
  }, [showModal, sidebarTypeFilter, defaultRecordedTypeBySidebar, defaultCourseTypeBySidebar]);

  const filteredCourses = courses.filter((course) => {
    const source = `${course.title || ''} ${course.description || ''} ${course.price || ''} ${course.delivery_mode || ''} ${course.recorded_type || ''} ${course.pricing_type || ''}`.toLowerCase();
    const matchesSearch = source.includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    const normalizedCourseType = String(course.course_type || '').toLowerCase();
    const isShortByRecordedType = isShortCourseType(course.recorded_type);
    const isShortByType = isShortByCourseType(course.course_type) || isShortByRecordedType;
    if (sidebarTypeFilter === 'short') {
      return isShortByType;
    }
    if (sidebarTypeFilter === 'chapter') {
      if (isShortByType) return false;
      return normalizedCourseType.includes('chapter') || isChapterCourseType(course.recorded_type, course.delivery_mode);
    }
    return true;
  });

  const liveCoursesCount = courses.filter((course) => (course.delivery_mode || '').toLowerCase() === 'live').length;
  const recordedCoursesCount = courses.filter((course) => (course.delivery_mode || '').toLowerCase() === 'recorded').length;
  const chapterTopicCount = courses.filter((course) => {
    const isShort = isShortByCourseType(course.course_type) || isShortCourseType(course.recorded_type);
    return !isShort && isChapterCourseType(course.recorded_type, course.delivery_mode);
  }).length;
  const shortCoursesCount = courses.filter((course) => isShortByCourseType(course.course_type) || isShortCourseType(course.recorded_type)).length;
  const freeForMembersCount = courses.filter(
    (course) => (course.pricing_type || '').toLowerCase() === 'free for members' || Number(course.price) === 0,
  ).length;
  const paidCoursesCount = courses.filter(
    (course) => (course.pricing_type || '').toLowerCase() === 'paid' || Number(course.price) > 0,
  ).length;

  const formatDate = (input) => {
    if (!input) return '-';
    return new Date(input).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPrice = (price) => {
    const value = Number(price);
    if (Number.isNaN(value)) return '-';
    return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  };

  return (
    <DashboardSectionPage title="Course Management">
      <div className="container-fluid px-0" style={{ maxWidth: 1200 }}>
        <div className="lms-card p-4 p-md-5 mb-3 text-white" style={{ background: 'linear-gradient(90deg,#071d3d,#0d2f69 45%,#0a5dea)' }}>
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
            <div>
              <p className="text-uppercase small mb-1 text-light">Learning Hub</p>
              <h1 className="h2 fw-bold mb-1">Course Management</h1>
              <p className="mb-0 text-light">Manage live and recorded courses with analytics and engagement.</p>
            </div>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-light text-dark fs-6">{filteredCourses.length} records</span>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setFeedback('');
                  setFormData((prev) => ({
                    ...prev,
                    deliveryMode: 'Recorded',
                    recordedType: defaultRecordedTypeBySidebar,
                    courseType: defaultCourseTypeBySidebar,
                  }));
                  setShowModal(true);
                }}
                className="btn btn-warning fw-bold"
              >
                + Add course
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
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6">
              <div className="border rounded-3 p-3 h-100">
                <p className="mb-1 text-uppercase small text-muted">Live</p>
                <h3 className="h5 mb-2">{liveCoursesCount} Courses</h3>
                <div className="d-flex flex-wrap gap-2">
                  <span className="badge text-bg-light">CRUD</span>
                  <span className="badge text-bg-light">Analytics</span>
                  <span className="badge text-bg-light">Likes</span>
                  <span className="badge text-bg-light">Comments</span>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6">
              <div className="border rounded-3 p-3 h-100">
                <p className="mb-1 text-uppercase small text-muted">Recorded</p>
                <h3 className="h5 mb-2">{recordedCoursesCount} Courses</h3>
                <div className="small text-muted">
                  <div>Chapter Wise/Topic Wise: <strong>{chapterTopicCount}</strong></div>
                  <div>Short Courses: <strong>{shortCoursesCount}</strong></div>
                  <div>Free for Members: <strong>{freeForMembersCount}</strong></div>
                  <div>Paid Courses: <strong>{paidCoursesCount}</strong></div>
                </div>
                <div className="d-flex flex-wrap gap-2 mt-2">
                  <span className="badge text-bg-light">CRUD</span>
                  <span className="badge text-bg-light">Analytics</span>
                  <span className="badge text-bg-light">Likes</span>
                  <span className="badge text-bg-light">Comments</span>
                </div>
              </div>
            </div>
          </div>
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
            <div className="w-100" style={{ maxWidth: 520 }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by title, type, pricing, description, price..."
                className="form-control form-control-lg"
              />
            </div>
            <small className="text-muted">
              Showing <strong>{filteredCourses.length}</strong> of <strong>{courses.length}</strong>
            </small>
          </div>
        </div>

        <div className="lms-card p-0 mb-3 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-4">Title</th>
                  <th>Mode</th>
                  <th className="d-none d-lg-table-cell">Recorded Type</th>
                  <th>Pricing</th>
                  <th>Description</th>
                  <th>Price</th>
                  <th className="d-none d-md-table-cell">Created on</th>
                  <th className="text-end pe-4">Details</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingCourses ? (
                  <tr>
                    <td colSpan={8} className="text-center py-5 text-muted">Loading courses...</td>
                  </tr>
                ) : filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-5 text-muted">
                      {sidebarTypeFilter === 'short'
                        ? 'No short courses found.'
                        : sidebarTypeFilter === 'chapter'
                          ? 'No chapter wise courses found.'
                          : 'No courses found.'}
                    </td>
                  </tr>
                ) : (
                  filteredCourses.map((course) => (
                    <tr key={course.id || course.title}>
                      <td className="ps-4 fw-semibold">{course.title || '-'}</td>
                      <td>
                        <span className={`badge ${(course.delivery_mode || 'Recorded') === 'Live' ? 'text-bg-warning' : 'text-bg-secondary'}`}>
                          {course.delivery_mode || 'Recorded'}
                        </span>
                      </td>
                      <td className="d-none d-lg-table-cell">{course.recorded_type || '-'}</td>
                      <td>
                        <span className={`badge ${((course.pricing_type || '').toLowerCase() === 'free for members' || Number(course.price) === 0) ? 'text-bg-success' : 'text-bg-danger'}`}>
                          {course.pricing_type || (Number(course.price) === 0 ? 'Free for Members' : 'Paid')}
                        </span>
                      </td>
                      <td>{course.description || '-'}</td>
                      <td><span className="badge text-bg-info">{Number(course.price) === 0 ? 'Free' : formatPrice(course.price)}</span></td>
                      <td className="d-none d-md-table-cell">{formatDate(course.created_at)}</td>
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

        {showModal && (
          <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
            style={{ background: 'rgba(15,23,42,0.45)', zIndex: 1200 }}
          >
            <div className="card shadow-lg border-0 overflow-hidden" style={{ width: '100%', maxWidth: 720, borderRadius: 18 }}>
              <div className="card-header border-0 text-white p-4" style={{ background: 'linear-gradient(90deg,#071d3d,#0a5dea)' }}>
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <p className="mb-1 small text-uppercase text-light">Course Setup</p>
                    <h2 className="h4 mb-1">Add Course</h2>
                    <p className="mb-0 text-light small">Create a live or recorded course for your organization.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-light rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: 32, height: 32 }}
                    onClick={() => setShowModal(false)}
                    aria-label="Close"
                  >
                    x
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateCourse}>
                <div className="card-body p-4" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                  <div className="rounded-3 border bg-light p-3 mb-3">
                    <p className="small text-uppercase text-muted mb-2">Course Type</p>
                    <div className="row g-3">
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold">Course Type</label>
                        <select
                          name="courseType"
                          value={formData.courseType}
                          onChange={handleChange}
                          className="form-select"
                          disabled={sidebarTypeFilter === 'short' || sidebarTypeFilter === 'chapter'}
                        >
                          <option value="Chapter Wise Course">Chapter Wise Course</option>
                          <option value="Short Course">Short Course</option>
                          <option value="Workshop">Workshop</option>
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold">Delivery Mode</label>
                        <select
                          name="deliveryMode"
                          value={formData.deliveryMode}
                          onChange={handleChange}
                          className="form-select"
                          disabled={sidebarTypeFilter === 'short' || sidebarTypeFilter === 'chapter'}
                        >
                          <option value="Live">Live</option>
                          <option value="Recorded">Recorded</option>
                        </select>
                      </div>
                      {formData.deliveryMode === 'Recorded' && (
                        <div className="col-12 col-md-6">
                          <label className="form-label fw-semibold">Recorded Type</label>
                          <select
                            name="recordedType"
                            value={formData.recordedType}
                            onChange={handleChange}
                            className="form-select"
                          >
                            <option value="Chapter Wise/Topic Wise">Chapter Wise/Topic Wise</option>
                            <option value="Short Courses">Short Courses</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3 border p-3">
                    <p className="small text-uppercase text-muted mb-2">Course Details</p>
                    <div className="row g-3 mb-3">
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold">Pricing Type</label>
                        <select
                          name="pricingType"
                          value={formData.pricingType}
                          onChange={handleChange}
                          className="form-select"
                        >
                          <option value="Paid">Paid</option>
                          <option value="Free for Members">Free for Members</option>
                        </select>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Title</label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                        className="form-control"
                        placeholder="Course title"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Description</label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        required
                        className="form-control"
                        rows={4}
                        placeholder="Brief course description"
                      />
                    </div>
                    <div className="mb-0">
                      <label className="form-label fw-semibold">Price (INR)</label>
                      <input
                        type="number"
                        name="price"
                        value={formData.price}
                        onChange={handleChange}
                        required={formData.pricingType === 'Paid'}
                        min="0"
                        step="0.01"
                        className="form-control"
                        placeholder={formData.pricingType === 'Paid' ? '4999' : 'No price needed'}
                        disabled={formData.pricingType === 'Free for Members'}
                      />
                    </div>
                  </div>
                </div>

                <div className="card-footer bg-white border-0 px-4 pb-4 pt-2">
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline-secondary px-4">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="btn btn-primary px-4">
                      {isSubmitting ? 'Creating...' : 'Create course'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardSectionPage>
  );
}

