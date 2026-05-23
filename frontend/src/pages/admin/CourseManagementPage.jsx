import { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { useLocation, useNavigate } from 'react-router-dom';
import DashboardSectionPage from './DashboardSectionPage';
import { resolvePublicMediaUrl } from '../../utils/mediaUrl';

const STANDARD_RECORDED_TYPE_OPTIONS = ['Chapter Wise/Topic Wise', 'Short Course'];
const OWNING_MANHATTAN_RECORDED_TYPE_OPTIONS = ['Short Course', 'Podcast Episode'];

const getRecordedTypeOptions = (courseType) =>
  courseType === 'OwningManhattan'
    ? OWNING_MANHATTAN_RECORDED_TYPE_OPTIONS
    : STANDARD_RECORDED_TYPE_OPTIONS;

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
  const [omVideoFile, setOmVideoFile] = useState(null);
  const [omThumbnailFile, setOmThumbnailFile] = useState(null);
  const [viewLoadingCourseId, setViewLoadingCourseId] = useState(null);
  const [omCourseThumbById, setOmCourseThumbById] = useState({});

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  const uploadCourseMediaFile = async (token, file) => {
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(`${apiBaseUrl}/api/courses/upload-media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    const payload = await response.json();
    if (!response.ok || payload.status !== 'success' || !payload?.data?.url) {
      throw new Error(payload.message || 'File upload failed.');
    }
    return payload.data.url;
  };

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
          return { ...prev, courseType: value, deliveryMode: 'Recorded', recordedType: 'Short Course' };
        }
        if (value === 'OwningManhattan') {
          return { ...prev, courseType: value, deliveryMode: 'Recorded', recordedType: 'Short Course' };
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

    const isOmFlow = sidebarTypeFilter === 'owning-manhattan';
    if (isOmFlow && (!omVideoFile || !omThumbnailFile)) {
      setError('Please choose a video file and a thumbnail image for Owning Manhattan.');
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
          recorded_type:
            formData.deliveryMode === 'Recorded'
              ? formData.recordedType || 'Chapter Wise/Topic Wise'
              : null,
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

      const newCourseId = Number(payload?.data?.id);
      if (isOmFlow) {
        if (!newCourseId || Number.isNaN(newCourseId)) {
          throw new Error('Course was created but the server did not return its id. Add the video from the course detail page.');
        }
        try {
          const videoUrl = await uploadCourseMediaFile(token, omVideoFile);
          const thumbnailUrl = await uploadCourseMediaFile(token, omThumbnailFile);
          const titleTrim = formData.title.trim();
          const descTrim = formData.description.trim();
          const shortDesc = descTrim.length > 300 ? `${descTrim.slice(0, 297)}...` : descTrim || titleTrim;
          const videoResponse = await fetch(`${apiBaseUrl}/api/courses/${newCourseId}/videos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: titleTrim,
              short_description: shortDesc,
              description: descTrim,
              video_url: videoUrl,
              thumbnail_url: thumbnailUrl,
              content_type: 'video',
            }),
          });
          const videoPayload = await videoResponse.json();
          if (!videoResponse.ok || videoPayload.status !== 'success') {
            throw new Error(
              videoPayload.message ||
                'Saving the video record failed. Open the course from the list to try again.',
            );
          }
        } catch (attachErr) {
          setFeedback('');
          setError(
            `Course was created, but attaching the video failed: ${attachErr.message}. Open the course from the list to upload the video.`,
          );
          setFormData({
            title: '',
            description: '',
            price: '',
            deliveryMode: 'Recorded',
            recordedType: defaultRecordedTypeBySidebar,
            pricingType: 'Paid',
            courseType: defaultCourseTypeBySidebar,
          });
          setOmVideoFile(null);
          setOmThumbnailFile(null);
          setShowModal(false);
          await fetchCourses();
          return;
        }
      }

      setFeedback(isOmFlow ? 'Owning Manhattan course and video were created successfully.' : 'Course created successfully.');
      setFormData({
        title: '',
        description: '',
        price: '',
        deliveryMode: 'Recorded',
        recordedType: defaultRecordedTypeBySidebar,
        pricingType: 'Paid',
        courseType: defaultCourseTypeBySidebar,
      });
      setOmVideoFile(null);
      setOmThumbnailFile(null);
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
    if (typeParam === 'owning-manhattan') return 'owning-manhattan';
    return 'all';
  }, [location.search]);

  const normalizeRecordedType = (value) => String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  const normalizeCourseType = (value) => String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  const isShortCourseType = (value) => normalizeRecordedType(value).includes('shortcourse');
  const isShortByCourseType = (value) => normalizeCourseType(value).includes('shortcourse');
  const isOwningManhattanCourse = (course) => normalizeCourseType(course?.course_type) === 'owningmanhattan';
  const isChapterCourseType = (value, deliveryMode) => {
    const normalized = normalizeRecordedType(value);
    if (normalized.includes('chapterwise') || normalized.includes('topicwise')) return true;
    const mode = String(deliveryMode || '').toLowerCase();
    // Anything not Live is treated as recorded for legacy rows with null/empty mode.
    return mode !== 'live' && !normalized;
  };

  const defaultRecordedTypeBySidebar = useMemo(() => {
    if (sidebarTypeFilter === 'short') return 'Short Course';
    if (sidebarTypeFilter === 'owning-manhattan') return 'Short Course';
    if (sidebarTypeFilter === 'chapter') return 'Chapter Wise/Topic Wise';
    return 'Chapter Wise/Topic Wise';
  }, [sidebarTypeFilter]);

  const defaultCourseTypeBySidebar = useMemo(() => {
    if (sidebarTypeFilter === 'short') return 'Short Course';
    if (sidebarTypeFilter === 'owning-manhattan') return 'OwningManhattan';
    if (sidebarTypeFilter === 'chapter') return 'Chapter Wise Course';
    return 'Chapter Wise Course';
  }, [sidebarTypeFilter]);

  useEffect(() => {
    // Keep sidebar filter switch predictable by clearing stale search text.
    setSearchTerm('');
  }, [sidebarTypeFilter]);

  useEffect(() => {
    if (!showModal) return;
    if (sidebarTypeFilter !== 'short' && sidebarTypeFilter !== 'chapter' && sidebarTypeFilter !== 'owning-manhattan') {
      return;
    }
    setFormData((prev) => ({
      ...prev,
      deliveryMode: 'Recorded',
      recordedType: defaultRecordedTypeBySidebar,
      courseType: defaultCourseTypeBySidebar,
    }));
  }, [showModal, sidebarTypeFilter, defaultRecordedTypeBySidebar, defaultCourseTypeBySidebar]);

  const filterOnlyCourses = useMemo(() => {
    if (sidebarTypeFilter === 'all') return courses;
    return courses.filter((course) => {
      const normalizedCourseType = String(course.course_type || '').toLowerCase();
      const isShortByRecordedType = isShortCourseType(course.recorded_type);
      const isShortByType = isShortByCourseType(course.course_type) || isShortByRecordedType;
      if (sidebarTypeFilter === 'short') {
        return isShortByType;
      }
      if (sidebarTypeFilter === 'owning-manhattan') {
        return isOwningManhattanCourse(course);
      }
      if (sidebarTypeFilter === 'chapter') {
        if (isShortByType) return false;
        if (isOwningManhattanCourse(course)) return false;
        return normalizedCourseType.includes('chapter') || isChapterCourseType(course.recorded_type, course.delivery_mode);
      }
      return true;
    });
  }, [courses, sidebarTypeFilter]);

  const filteredCourses = useMemo(() => {
    const base = sidebarTypeFilter === 'all' ? courses : filterOnlyCourses;
    const query = searchTerm.trim().toLowerCase();
    if (!query) return base;
    return base.filter((course) => {
      const source = `${course.title || ''} ${course.description || ''} ${course.price || ''} ${course.delivery_mode || ''} ${course.recorded_type || ''} ${course.pricing_type || ''} ${course.course_type || ''}`.toLowerCase();
      return source.includes(query);
    });
  }, [courses, filterOnlyCourses, searchTerm, sidebarTypeFilter]);

  const omCatalogStats = useMemo(() => {
    if (sidebarTypeFilter !== 'owning-manhattan') return null;
    const rows = filterOnlyCourses;
    const isFreeRow = (c) => {
      const p = String(c.pricing_type || '').toLowerCase();
      return p === 'free for members' || Number(c.price) === 0;
    };
    const free = rows.filter(isFreeRow).length;
    const paid = Math.max(0, rows.length - free);
    return { total: rows.length, paid, free };
  }, [sidebarTypeFilter, filterOnlyCourses]);

  useEffect(() => {
    if (sidebarTypeFilter !== 'owning-manhattan') {
      setOmCourseThumbById({});
      return undefined;
    }
    if (isLoadingCourses) return undefined;
    const omList = filterOnlyCourses;
    if (!omList.length) {
      setOmCourseThumbById({});
      return undefined;
    }
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        omList.map(async (course) => {
          const cid = course.id;
          if (cid == null) return [null, ''];
          try {
            const res = await fetch(`${apiBaseUrl}/api/courses/${cid}/videos`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await res.json();
            if (!res.ok || payload.status !== 'success') return [String(cid), ''];
            const list = Array.isArray(payload.data) ? payload.data : [];
            const v = list.find((row) => row.thumbnail_url || row.thumbnail_data_url) || list[0];
            const raw = v?.thumbnail_url || v?.thumbnail_data_url || '';
            return [String(cid), resolvePublicMediaUrl(raw, apiBaseUrl)];
          } catch {
            return [String(cid), ''];
          }
        }),
      );
      if (cancelled) return;
      const next = {};
      entries.forEach(([k, v]) => {
        if (k != null) next[k] = v;
      });
      setOmCourseThumbById(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [sidebarTypeFilter, isLoadingCourses, filterOnlyCourses, apiBaseUrl]);

  const statsCourses = sidebarTypeFilter === 'all' ? courses : filterOnlyCourses;

  const liveCoursesCount = statsCourses.filter((course) => String(course?.delivery_mode || '').toLowerCase() === 'live').length;
  const recordedCoursesCount = statsCourses.filter(
    (course) => String(course?.delivery_mode || '').toLowerCase() !== 'live',
  ).length;
  const chapterTopicCount = statsCourses.filter((course) => {
    const isShort = isShortByCourseType(course.course_type) || isShortCourseType(course.recorded_type);
    if (isOwningManhattanCourse(course)) return false;
    return !isShort && isChapterCourseType(course.recorded_type, course.delivery_mode);
  }).length;
  const shortCoursesCount = statsCourses.filter((course) => isShortByCourseType(course.course_type) || isShortCourseType(course.recorded_type)).length;
  const freeForMembersCount = statsCourses.filter(
    (course) => (course.pricing_type || '').toLowerCase() === 'free for members' || Number(course.price) === 0,
  ).length;
  const paidCoursesCount = statsCourses.filter(
    (course) => (course.pricing_type || '').toLowerCase() === 'paid' || Number(course.price) > 0,
  ).length;

  const pageTitle = useMemo(() => {
    if (sidebarTypeFilter === 'owning-manhattan') return 'Owning Manhattan';
    if (sidebarTypeFilter === 'short') return 'Short Courses';
    if (sidebarTypeFilter === 'chapter') return 'Chapter Wise Course';
    return 'Course Management';
  }, [sidebarTypeFilter]);

  const pageHeroTitle = pageTitle;
  const pageHeroSubtitle = useMemo(() => {
    if (sidebarTypeFilter === 'owning-manhattan') {
      return 'Create and manage courses tagged for the Owning Manhattan member experience.';
    }
    if (sidebarTypeFilter === 'short') {
      return 'Manage short-form recorded courses for your organization.';
    }
    if (sidebarTypeFilter === 'chapter') {
      return 'Manage chapter-wise and topic-wise recorded courses.';
    }
    return 'Manage live and recorded courses with analytics and engagement.';
  }, [sidebarTypeFilter]);

  const heroKicker = useMemo(() => {
    if (sidebarTypeFilter === 'owning-manhattan') return 'Catalog';
    if (sidebarTypeFilter === 'short') return 'Short form';
    if (sidebarTypeFilter === 'chapter') return 'Chapter wise';
    return 'Learning Hub';
  }, [sidebarTypeFilter]);

  const listTotalLabel = sidebarTypeFilter === 'all' ? courses.length : filterOnlyCourses.length;
  const isOmCreateModal = sidebarTypeFilter === 'owning-manhattan';

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

  const openAdminFirstVideoOrCourse = async (courseId, options = {}) => {
    const { omAdminReturnPath } = options;
    const sid = String(courseId);
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    setViewLoadingCourseId(sid);
    let firstVideoId = null;
    try {
      const response = await fetch(`${apiBaseUrl}/api/courses/${courseId}/videos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      const list = Array.isArray(payload?.data) ? payload.data : [];
      if (response.ok && payload.status === 'success' && list[0]?.id != null) {
        firstVideoId = list[0].id;
      }
    } catch {
      firstVideoId = null;
    } finally {
      setViewLoadingCourseId(null);
    }
    if (firstVideoId != null) {
      navigate(`/dashboard/course-management/${courseId}/videos/${firstVideoId}`, {
        ...(omAdminReturnPath ? { state: { omAdminReturnPath } } : {}),
      });
    } else {
      navigate(`/dashboard/course-management/${courseId}`);
    }
  };

  const openOwningManhattanCreateModal = () => {
    setError('');
    setFeedback('');
    setOmVideoFile(null);
    setOmThumbnailFile(null);
    setFormData((prev) => ({
      ...prev,
      deliveryMode: 'Recorded',
      recordedType: defaultRecordedTypeBySidebar,
      courseType: defaultCourseTypeBySidebar,
    }));
    setShowModal(true);
  };

  return (
    <DashboardSectionPage title={pageTitle}>
      <div
        className="container-fluid px-0"
        style={{ maxWidth: sidebarTypeFilter === 'owning-manhattan' ? 1280 : 1200 }}
      >
        {sidebarTypeFilter === 'owning-manhattan' ? (
          <div className="lms-om-admin-page lms-om-admin-page--premium">
            <header className="lms-om-admin-hero lms-om-admin-hero--premium lms-card border-0 mb-4 overflow-hidden">
              <div className="lms-om-admin-hero-premium-bg" aria-hidden />
              <div className="position-relative p-4 p-md-5">
                <div className="d-flex flex-column flex-xl-row align-items-xl-start justify-content-xl-between gap-4">
                  <div className="flex-grow-1" style={{ minWidth: 'min(100%, 280px)' }}>
                    <p className="lms-om-admin-eyebrow-premium mb-2">Admin · Member catalog</p>
                    <h1 className="lms-om-admin-title-premium mb-0">
                      Owning <span className="lms-om-admin-title-accent">Manhattan</span>
                    </h1>
                  </div>
                  <div className="d-flex flex-column align-items-stretch align-items-xl-end gap-3  w-100 w-xl-auto">
                    <button
                      type="button"
                      className="btn lms-om-admin-cta-premium rounded-pill px-4 py-2 fw-semibold border-0"
                      onClick={openOwningManhattanCreateModal}
                    >
                      <span className="lms-om-admin-cta-icon" aria-hidden>
                        +
                      </span>
                      Add Owning Manhattan
                    </button>
                    {omCatalogStats ? (
                      <div className="lms-om-admin-stat-strip">
                        <div className="lms-om-admin-stat-tile">
                          <span className="lms-om-admin-stat-value">{omCatalogStats.total}</span>
                          <span className="lms-om-admin-stat-label">In catalog</span>
                        </div>
                        <div className="lms-om-admin-stat-tile">
                          <span className="lms-om-admin-stat-value">{omCatalogStats.paid}</span>
                          <span className="lms-om-admin-stat-label">Paid</span>
                        </div>
                        <div className="lms-om-admin-stat-tile">
                          <span className="lms-om-admin-stat-value">{omCatalogStats.free}</span>
                          <span className="lms-om-admin-stat-label">Complimentary</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </header>

            {error ? (
              <div className="alert alert-danger py-2 px-3 mb-3 rounded-3 border-0 shadow-sm lms-om-admin-alert">{error}</div>
            ) : null}
            {feedback ? (
              <div className="alert alert-success py-2 px-3 mb-3 rounded-3 border-0 shadow-sm lms-om-admin-alert">
                {feedback}
              </div>
            ) : null}

            <section className="lms-om-admin-catalog lms-om-admin-catalog--premium lms-card border-0 mb-3">
              <div className="lms-om-admin-toolbar lms-om-admin-toolbar--premium d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
                <div className="lms-om-admin-search lms-om-admin-search--premium w-100" style={{ maxWidth: 420 }}>
                  <label htmlFor="om-course-mgmt-search" className="form-label small text-muted mb-1 d-lg-none">
                    Search catalog
                  </label>
                  <div className="lms-om-admin-search-inner">
                    <span className="lms-om-admin-search-icon" aria-hidden>
                      ⌕
                    </span>
                    <input
                      id="om-course-mgmt-search"
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search title or description…"
                      className="form-control border-0 shadow-none"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>

              {isLoadingCourses ? (
                <div className="lms-om-admin-loading py-5 text-center">
                  <div className="lms-om-admin-spinner mx-auto mb-3" aria-hidden />
                  <p className="text-muted small mb-0">Loading catalog…</p>
                </div>
              ) : filteredCourses.length === 0 ? (
                <div className="lms-om-admin-empty lms-om-admin-empty--premium">
                  <div className="lms-om-admin-empty-icon mb-3" aria-hidden>
                    ◆
                  </div>
                  <p className="mb-2 fw-semibold lms-om-admin-empty-title">No episodes in view</p>
                  <p className="mb-0 small lms-om-admin-empty-copy">
                    {searchTerm.trim()
                      ? 'Try a different search, or clear the field to see the full catalog.'
                      : 'Publish your first Owning Manhattan episode — video, thumbnail, and pricing — with Add Owning Manhattan.'}
                  </p>
                </div>
              ) : (
                <div className="lms-om-admin-grid lms-om-admin-grid--premium">
                  {filteredCourses.map((course) => {
                    const thumbSrc = omCourseThumbById[String(course.id)] || '';
                    return (
                    <article key={course.id || course.title} className="lms-om-admin-card lms-om-admin-card--premium">
                      <div className="lms-om-admin-card-shine" aria-hidden />
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2 position-relative">
                        <span className="badge rounded-pill lms-om-admin-badge-series">Owning Manhattan</span>
                        <span
                          className={`badge rounded-pill lms-om-admin-badge-mode ${(course.delivery_mode || 'Recorded') === 'Live' ? 'is-live' : ''}`}
                        >
                          {course.delivery_mode || 'Recorded'}
                        </span>
                      </div>
                      <h3 className="lms-om-admin-card-title">{course.title || 'Untitled'}</h3>
                      <p className="lms-om-admin-card-desc">{course.description || 'No description added.'}</p>
                      <div
                        className={`lms-om-admin-card-preview lms-om-admin-card-preview--premium${thumbSrc ? ' has-thumb' : ''}`}
                      >
                        {thumbSrc ? (
                          <img
                            src={thumbSrc}
                            alt=""
                            className="lms-om-admin-card-preview-img"
                            loading="lazy"
                          />
                        ) : null}
                        <span className="lms-om-admin-card-preview-label">HD · multi-bitrate · analytics</span>
                      </div>
                      <p className="lms-om-admin-card-date mb-0">Added {formatDate(course.created_at)}</p>
                      <div className="lms-om-admin-card-footer-meta">
                        <span
                          className={`badge rounded-pill lms-om-admin-badge-price ${((course.pricing_type || '').toLowerCase() === 'free for members' || Number(course.price) === 0) ? 'is-free' : 'is-paid'}`}
                        >
                          {course.pricing_type || (Number(course.price) === 0 ? 'Free for Members' : 'Paid')}
                        </span>
                        <span className="badge rounded-pill lms-om-admin-badge-muted">
                          {Number(course.price) === 0 ? 'Free' : formatPrice(course.price)}
                        </span>
                        <span className="badge rounded-pill lms-om-admin-badge-muted">
                          {course.recorded_type === 'Short Courses' ? 'Short Course' : course.recorded_type || '—'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn lms-om-admin-card-btn rounded-pill w-100 mt-auto fw-semibold"
                        disabled={viewLoadingCourseId === String(course.id)}
                        onClick={() =>
                          openAdminFirstVideoOrCourse(course.id, {
                            omAdminReturnPath: '/dashboard/course-management?type=owning-manhattan',
                          })
                        }
                      >
                        {viewLoadingCourseId === String(course.id) ? 'Opening…' : 'Open studio'}
                      </button>
                    </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : (
          <>
            <div className="lms-course-mgmt-page">
              <div
                className="lms-card p-4 p-md-5 mb-3 text-white border-0 rounded-4 lms-course-mgmt-hero"
                style={{
                  background: 'linear-gradient(115deg,#051a3a 0%,#0d2f69 42%,#0a5dea 88%)',
                  boxShadow: '0 18px 44px rgba(7,29,61,0.28)',
                }}
              >
                <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-4">
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <p className="text-uppercase small mb-2 fw-semibold text-white-50" style={{ letterSpacing: '0.06em' }}>{heroKicker}</p>
                    <h1 className="h2 fw-bold mb-2 lh-sm">{pageHeroTitle}</h1>
                    <p className="mb-0 text-white-50 small" style={{ maxWidth: '36rem' }}>{pageHeroSubtitle}</p>
                  </div>
                  <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 flex-shrink-0">
                    <span className="badge bg-white text-dark fs-6 fw-semibold rounded-pill px-3 py-2 align-self-sm-center">
                      {filteredCourses.length} {filteredCourses.length === 1 ? 'record' : 'records'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setFeedback('');
                        setOmVideoFile(null);
                        setOmThumbnailFile(null);
                        setFormData((prev) => ({
                          ...prev,
                          deliveryMode: 'Recorded',
                          recordedType: defaultRecordedTypeBySidebar,
                          courseType: defaultCourseTypeBySidebar,
                        }));
                        setShowModal(true);
                      }}
                      className="btn btn-warning fw-bold rounded-pill px-4 shadow-sm"
                    >
                      + Add course
                    </button>
                  </div>
                </div>
              </div>

              {error ? <div className="alert alert-danger py-2 mb-3">{error}</div> : null}
              {feedback ? <div className="alert alert-success py-2 mb-3">{feedback}</div> : null}

              <div className="lms-card p-3 p-md-4 mb-3 rounded-4 border-0 shadow-sm">
                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <div className="rounded-4 border bg-light bg-opacity-50 p-3 h-100">
                      <p className="mb-1 text-uppercase small text-muted fw-semibold">Live</p>
                      <h3 className="h5 mb-3 fw-bold">{liveCoursesCount} <span className="fw-normal text-muted fs-6">courses</span></h3>
                      <div className="d-flex flex-wrap gap-2">
                        <span className="badge rounded-pill text-bg-light border">CRUD</span>
                        <span className="badge rounded-pill text-bg-light border">Analytics</span>
                        <span className="badge rounded-pill text-bg-light border">Likes</span>
                        <span className="badge rounded-pill text-bg-light border">Comments</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="rounded-4 border bg-light bg-opacity-50 p-3 h-100">
                      <p className="mb-1 text-uppercase small text-muted fw-semibold">Recorded</p>
                      <h3 className="h5 mb-3 fw-bold">{recordedCoursesCount} <span className="fw-normal text-muted fs-6">courses</span></h3>
                      <ul className="list-unstyled small text-muted mb-0 vstack gap-2">
                        <li className="d-flex justify-content-between gap-2 border-bottom border-light pb-2">
                          <span>Chapter Wise / Topic Wise</span>
                          <strong className="text-dark">{chapterTopicCount}</strong>
                        </li>
                        <li className="d-flex justify-content-between gap-2 border-bottom border-light pb-2">
                          <span>Short courses</span>
                          <strong className="text-dark">{shortCoursesCount}</strong>
                        </li>
                        <li className="d-flex justify-content-between gap-2 border-bottom border-light pb-2">
                          <span>Free for Members</span>
                          <strong className="text-success">{freeForMembersCount}</strong>
                        </li>
                        <li className="d-flex justify-content-between gap-2 pt-1">
                          <span>Paid</span>
                          <strong className="text-danger">{paidCoursesCount}</strong>
                        </li>
                      </ul>
                      <div className="d-flex flex-wrap gap-2 mt-3">
                        <span className="badge rounded-pill text-bg-light border">CRUD</span>
                        <span className="badge rounded-pill text-bg-light border">Analytics</span>
                        <span className="badge rounded-pill text-bg-light border">Likes</span>
                        <span className="badge rounded-pill text-bg-light border">Comments</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 bg-body-secondary bg-opacity-25 rounded-4 p-3">
                  <div className="w-100" style={{ maxWidth: 520 }}>
                    <label htmlFor="course-mgmt-search" className="form-label small text-muted mb-1 d-md-none">Search</label>
                    <input
                      id="course-mgmt-search"
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search by title, course type, pricing, description, price..."
                      className="form-control form-control-lg border-0 shadow-sm"
                    />
                  </div>
                  <div className="text-md-end">
                    <span className="badge rounded-pill bg-white text-secondary border px-3 py-2 fw-medium">
                      Showing <span className="text-dark">{filteredCourses.length}</span>
                      <span className="text-muted"> / </span>
                      <span className="text-dark">{listTotalLabel}</span>
                      {sidebarTypeFilter !== 'all' && (
                        <span className="d-none d-lg-inline text-muted fw-normal"> · {courses.length} in org</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="lms-card p-0 mb-3 overflow-hidden rounded-4 border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 small lms-course-mgmt-table">
                    <thead className="table-light">
                      <tr className="text-secondary text-uppercase small">
                        <th className="ps-4 py-3 fw-semibold border-0">Title</th>
                        <th className="py-3 fw-semibold border-0">Mode</th>
                        <th className="d-none d-md-table-cell py-3 fw-semibold border-0">Catalog type</th>
                        <th className="d-none d-lg-table-cell py-3 fw-semibold border-0">Recorded Type</th>
                        <th className="py-3 fw-semibold border-0">Pricing</th>
                        <th className="py-3 fw-semibold border-0">Description</th>
                        <th className="py-3 fw-semibold border-0">Price</th>
                        <th className="d-none d-md-table-cell py-3 fw-semibold border-0">Created</th>
                        <th className="text-end pe-4 py-3 fw-semibold border-0">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingCourses ? (
                        <tr>
                          <td colSpan={9} className="text-center py-5 text-muted">Loading courses...</td>
                        </tr>
                      ) : filteredCourses.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-5 px-4 text-muted">
                            <div className="mx-auto" style={{ maxWidth: '28rem' }}>
                              {sidebarTypeFilter === 'short'
                                ? 'No short courses found.'
                                : sidebarTypeFilter === 'chapter'
                                  ? 'No chapter wise courses found.'
                                  : 'No courses found.'}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredCourses.map((course) => (
                          <tr key={course.id || course.title}>
                            <td className="ps-4 fw-semibold text-dark">{course.title || '-'}</td>
                            <td>
                              <span className={`badge rounded-pill ${(course.delivery_mode || 'Recorded') === 'Live' ? 'text-bg-warning' : 'text-bg-secondary'}`}>
                                {course.delivery_mode || 'Recorded'}
                              </span>
                            </td>
                            <td className="d-none d-md-table-cell">
                              {course.course_type === 'OwningManhattan' ? (
                                <span className="badge rounded-pill text-bg-primary">Owning Manhattan</span>
                              ) : (
                                <span className="text-muted">{course.course_type || '—'}</span>
                              )}
                            </td>
                            <td className="d-none d-lg-table-cell text-muted">
                              {course.recorded_type === 'Short Courses' ? 'Short Course' : course.recorded_type || '—'}
                            </td>
                            <td>
                              <span className={`badge rounded-pill ${((course.pricing_type || '').toLowerCase() === 'free for members' || Number(course.price) === 0) ? 'text-bg-success' : 'text-bg-danger'}`}>
                                {course.pricing_type || (Number(course.price) === 0 ? 'Free for Members' : 'Paid')}
                              </span>
                            </td>
                            <td className="text-muted text-break" style={{ maxWidth: 240 }}>{course.description || '—'}</td>
                            <td><span className="badge rounded-pill text-bg-info">{Number(course.price) === 0 ? 'Free' : formatPrice(course.price)}</span></td>
                            <td className="d-none d-md-table-cell text-muted">{formatDate(course.created_at)}</td>
                            <td className="text-end pe-4">
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm rounded-pill px-3"
                                disabled={viewLoadingCourseId === String(course.id)}
                                onClick={() => openAdminFirstVideoOrCourse(course.id)}
                              >
                                {viewLoadingCourseId === String(course.id) ? '…' : 'View'}
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
          </>
        )}

        {showModal && (
          <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
            style={{ background: 'rgba(15,23,42,0.45)', zIndex: 1200 }}
          >
            <div
              className={`card shadow-lg border-0 overflow-hidden ${isOmCreateModal ? 'lms-om-admin-modal-card lms-om-admin-modal-card--premium' : ''}`}
              style={{ width: '100%', maxWidth: isOmCreateModal ? 740 : 720, borderRadius: 18 }}
            >
              <div
                className={`card-header border-0 text-white p-4 ${isOmCreateModal ? 'lms-om-admin-modal-header--premium' : ''}`}
                style={
                  isOmCreateModal
                    ? undefined
                    : { background: 'linear-gradient(90deg,#071d3d,#0a5dea)' }
                }
              >
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <p className="mb-1 small text-uppercase text-light">{isOmCreateModal ? 'Admin Upload' : 'Course Setup'}</p>
                    <h2 className="h4 mb-1">{isOmCreateModal ? 'Add Owning Manhattan' : 'Add Course'}</h2>
                    <p className="mb-0 text-light small">
                      {isOmCreateModal
                        ? 'Publish a catalog episode: details first, then video and thumbnail (saved like Sell It Snacks).'
                        : 'Create a live or recorded course for your organization.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-light rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: 32, height: 32 }}
                    onClick={() => {
                      setShowModal(false);
                      setOmVideoFile(null);
                      setOmThumbnailFile(null);
                    }}
                    aria-label="Close"
                  >
                    x
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateCourse}>
                <div className="card-body p-4" style={{ maxHeight: isOmCreateModal ? '68vh' : '65vh', overflowY: 'auto' }}>
                  <div className="rounded-3 border bg-light p-3 mb-3">
                    <p className="small text-uppercase text-muted mb-2">{isOmCreateModal ? 'Publishing setup' : 'Course Type'}</p>
                    <div className="row g-3">
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold">{isOmCreateModal ? 'Owning Manhattan' : 'Course Type'}</label>
                        <select
                          name="courseType"
                          value={formData.courseType}
                          onChange={handleChange}
                          className="form-select"
                          disabled={sidebarTypeFilter === 'short' || sidebarTypeFilter === 'chapter' || sidebarTypeFilter === 'owning-manhattan'}
                        >
                          <option value="Chapter Wise Course">Chapter Wise Course</option>
                          <option value="Short Course">Short Course</option>
                          <option value="Workshop">Workshop</option>
                          <option value="OwningManhattan">Owning Manhattan</option>
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold">Delivery Mode</label>
                        <select
                          name="deliveryMode"
                          value={formData.deliveryMode}
                          onChange={handleChange}
                          className="form-select"
                          disabled={sidebarTypeFilter === 'short' || sidebarTypeFilter === 'chapter' || sidebarTypeFilter === 'owning-manhattan'}
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
                            value={formData.recordedType || 'Chapter Wise/Topic Wise'}
                            onChange={handleChange}
                            className="form-select"
                          >
                            {getRecordedTypeOptions(formData.courseType).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3 border p-3 mb-3">
                    <p className="small text-uppercase text-muted mb-2">{isOmCreateModal ? 'Episode details' : 'Course Details'}</p>
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
                      <label className="form-label fw-semibold">{isOmCreateModal ? 'Episode title' : 'Title'}</label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                        className="form-control"
                        placeholder={isOmCreateModal ? 'Episode headline for members' : 'Course title'}
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
                        placeholder={isOmCreateModal ? 'Brief Owning Manhattan description' : 'Brief course description'}
                      />
                    </div>
                    {isOmCreateModal && (
                      <div className="rounded-3 border p-3 mb-3">
                        <p className="small text-uppercase text-muted mb-2">Media files</p>
                        <div className="mb-3">
                          <label className="form-label fw-semibold">
                            Select video <span className="text-danger">*</span>
                          </label>
                          <input
                            type="file"
                            className="form-control"
                            accept="video/*,.mp4,.webm,.mov,.m4v"
                            onChange={(e) => setOmVideoFile(e.target.files?.[0] || null)}
                          />
                          <small className="text-muted">Uploaded after the catalog row is created; multi-quality encoding runs in the background.</small>
                          {omVideoFile ? <div className="form-text">{omVideoFile.name}</div> : null}
                        </div>
                        <div className="mb-0">
                          <label className="form-label fw-semibold">
                            Upload thumbnail <span className="text-danger">*</span>
                          </label>
                          <input
                            type="file"
                            className="form-control"
                            accept="image/png,image/jpeg,image/webp,image/gif,.jpg,.jpeg,.png,.webp"
                            onChange={(e) => setOmThumbnailFile(e.target.files?.[0] || null)}
                          />
                          <small className="text-muted">Recommended for cards and the student library.</small>
                          {omThumbnailFile ? <div className="form-text">{omThumbnailFile.name}</div> : null}
                        </div>
                      </div>
                    )}
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
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        setOmVideoFile(null);
                        setOmThumbnailFile(null);
                      }}
                      className="btn btn-outline-secondary px-4"
                    >
                      Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting} className="btn btn-primary px-4">
                      {isSubmitting
                        ? isOmCreateModal
                          ? 'Uploading...'
                          : 'Creating...'
                        : isOmCreateModal
                          ? 'Publish episode'
                          : 'Create course'}
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
