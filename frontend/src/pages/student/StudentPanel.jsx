import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentDashboardSectionPage from './StudentDashboardSectionPage';

const COURSE_PAGE_SIZE = 8;

export default function StudentPanel() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [courseFirstVideoThumbMap, setCourseFirstVideoThumbMap] = useState({});
  const [courseProgressPercentMap, setCourseProgressPercentMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [headerSearch, setHeaderSearch] = useState('');
  const [visibleCourseCount, setVisibleCourseCount] = useState(COURSE_PAGE_SIZE);
  const [bookmarkedCourseIds, setBookmarkedCourseIds] = useState(() => {
    try {
      const raw = localStorage.getItem('student_bookmarked_course_ids');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  });

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

        const courseMetaEntries = await Promise.all(
          fetchedCourses.map(async (course) => {
            try {
              const videoResponse = await fetch(`${apiBaseUrl}/api/courses/${course.id}/videos`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const videoPayload = await videoResponse.json();
              if (!videoResponse.ok || videoPayload.status !== 'success') {
                return [String(course.id), { thumb: '', progress: 0 }];
              }
              const courseVideos = videoPayload.data || [];
              const firstVideo = courseVideos[0] || null;
              const firstThumb = firstVideo?.thumbnail_url || firstVideo?.thumbnail_data_url || '';
              let progressPercent = 0;
              if (courseVideos.length > 0) {
                const engagementResponse = await fetch(`${apiBaseUrl}/api/courses/${course.id}/videos/engagement`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const engagementPayload = await engagementResponse.json();
                if (engagementResponse.ok && engagementPayload.status === 'success') {
                  const progressMap = engagementPayload?.data?.progress || {};
                  const completedCount = courseVideos.filter((video) => Boolean(progressMap[String(video.id)])).length;
                  progressPercent = Math.round((completedCount / courseVideos.length) * 100);
                }
              }
              return [String(course.id), { thumb: firstThumb, progress: progressPercent }];
            } catch {
              return [String(course.id), { thumb: '', progress: 0 }];
            }
          }),
        );
        const nextThumbMap = {};
        const nextProgressMap = {};
        courseMetaEntries.forEach(([courseKey, meta]) => {
          nextThumbMap[courseKey] = meta?.thumb || '';
          nextProgressMap[courseKey] = Number(meta?.progress || 0);
        });
        setCourseFirstVideoThumbMap(nextThumbMap);
        setCourseProgressPercentMap(nextProgressMap);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchBookmarkedCourses = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/courses/bookmarks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') {
          return;
        }
        const ids = Array.isArray(payload?.data?.course_ids) ? payload.data.course_ids.map(String) : [];
        setBookmarkedCourseIds(ids);
        localStorage.setItem('student_bookmarked_course_ids', JSON.stringify(ids));
      } catch {
        // keep local fallback if bookmark fetch fails
      }
    };

    fetchCourses();
    fetchBookmarkedCourses();
  }, [apiBaseUrl]);

  const liveCount = courses.filter((course) => (course.delivery_mode || '').toLowerCase() === 'live').length;
  const recordedCount = courses.filter((course) => (course.delivery_mode || '').toLowerCase() === 'recorded').length;
  const isShortCourse = (course) => {
    const courseType = String(course?.course_type || '').toLowerCase();
    const recordedType = String(course?.recorded_type || '').toLowerCase();
    return courseType.includes('short') || recordedType.includes('short');
  };
  const shortCoursesCount = courses.filter((course) => isShortCourse(course)).length;

  const savedMyCourseIds = (() => {
    try {
      const raw = localStorage.getItem('student_my_course_ids');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  })();

  const myCourses = courses.filter((course) => {
    if (savedMyCourseIds.length > 0) return savedMyCourseIds.includes(String(course.id));
    return Number(course.price) === 0;
  });

  const bookmarkedCourses = useMemo(
    () => courses.filter((course) => bookmarkedCourseIds.includes(String(course.id))),
    [courses, bookmarkedCourseIds],
  );

  const displayedCourses = useMemo(() => {
    const shortCourses = courses.filter((course) => isShortCourse(course));
    const baseCourses = activeTab === 'my'
      ? myCourses
      : activeTab === 'short'
        ? shortCourses
        : activeTab === 'bookmarks'
          ? bookmarkedCourses
          : courses;
    const query = headerSearch.trim().toLowerCase();
    if (!query) return baseCourses;
    return baseCourses.filter((course) => {
      const title = String(course.title || '').toLowerCase();
      const description = String(course.description || '').toLowerCase();
      const mode = String(course.delivery_mode || '').toLowerCase();
      return title.includes(query) || description.includes(query) || mode.includes(query);
    });
  }, [activeTab, courses, myCourses, headerSearch, bookmarkedCourseIds]);

  const visibleCourses = useMemo(
    () => displayedCourses.slice(0, visibleCourseCount),
    [displayedCourses, visibleCourseCount],
  );
  const hasMoreCourses = visibleCourseCount < displayedCourses.length;

  useEffect(() => {
    setVisibleCourseCount(COURSE_PAGE_SIZE);
  }, [displayedCourses.length, activeTab, headerSearch]);

  useEffect(() => {
    const handleScrollPagination = () => {
      if (!hasMoreCourses) return;
      const scrollBottom = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 120;
      if (scrollBottom >= threshold) {
        setVisibleCourseCount((prev) => Math.min(prev + COURSE_PAGE_SIZE, displayedCourses.length));
      }
    };
    window.addEventListener('scroll', handleScrollPagination);
    return () => window.removeEventListener('scroll', handleScrollPagination);
  }, [hasMoreCourses, displayedCourses.length]);

  const toggleBookmarkCourse = async (courseId) => {
    const key = String(courseId);
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/courses/${courseId}/bookmark/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to update bookmark.');
      }
      const isBookmarked = Boolean(payload?.data?.bookmarked);
      setBookmarkedCourseIds((prev) => {
        const has = prev.includes(key);
        const next = isBookmarked
          ? has ? prev : [...prev, key]
          : prev.filter((id) => id !== key);
        localStorage.setItem('student_bookmarked_course_ids', JSON.stringify(next));
        return next;
      });
    } catch (bookmarkError) {
      setError(bookmarkError.message);
    }
  };

  return (
    <StudentDashboardSectionPage
      title="Student Panel"
      topHeaderSearchValue={headerSearch}
      onTopHeaderSearchChange={(event) => setHeaderSearch(event.target.value)}
      bookmarkLessons={bookmarkedCourses}
      onRemoveBookmarkLesson={toggleBookmarkCourse}
    >
      <div className="container-fluid px-0 student-panel-page" style={{ maxWidth: 1200 }}>
        {/* <div className="lms-card p-4 p-md-5 mb-4 text-white student-panel-hero">
          <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
            <div>
              <p className="text-uppercase small mb-2 student-panel-hero-label">Learning dashboard</p>
              <h1 className="h2 fw-bold mb-1">Student Panel</h1>
              <p className="mb-0 text-light">Browse all available courses and continue your learning path.</p>
            </div>
            <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold">
              Explore courses
            </button>
          </div>
        </div> */}

        {error && <div className="alert alert-danger mb-3">{error}</div>}

        {/* <div className="row g-3 mb-3">
          <div className="col-md-4">
            <div className="lms-card p-4 h-100 student-stat-card">
              <p className="text-muted mb-1">Total Courses</p>
              <h3 className="fw-bold mb-0">{courses.length}</h3>
            </div>
          </div>
          <div className="col-md-4">
            <div className="lms-card p-4 h-100 student-stat-card">
              <p className="text-muted mb-1">Live Courses</p>
              <h3 className="fw-bold mb-0">{liveCount}</h3>
            </div>
          </div>
          <div className="col-md-4">
            <div className="lms-card p-4 h-100 student-stat-card">
              <p className="text-muted mb-1">Recorded Courses</p>
              <h3 className="fw-bold mb-0">{recordedCount}</h3>
            </div>
          </div>
        </div> */}

        <div className="lms-card p-0 overflow-hidden">
          <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
            <h5 className="mb-0">Courses</h5>
            <div className="small text-muted">
              {liveCount} Live • {recordedCount} Recorded • {shortCoursesCount} Short Courses
            </div>
          </div>
          <div className="px-3 pb-3 pt-2 border-bottom">
            <div className="btn-group student-filter-tabs" role="group" aria-label="Course filter tabs">
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('all')}
              >
                All courses
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'my' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('my')}
              >
                My courses
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'short' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('short')}
              >
                Short courses
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'bookmarks' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('bookmarks')}
              >
                Bookmarks
              </button>
            </div>
          </div>
          <div className="p-3 p-md-4">
            {isLoading ? (
              <div className="text-center py-5 text-muted">Loading courses...</div>
            ) : displayedCourses.length === 0 ? (
              <div className="text-center py-5 text-muted">
                {activeTab === 'my'
                  ? 'No courses in My Courses yet.'
                  : activeTab === 'short'
                    ? 'No short courses available.'
                    : activeTab === 'bookmarks'
                      ? 'No bookmarked courses yet.'
                      : 'No courses available.'}
              </div>
            ) : (
              <div className="row g-3">
                {visibleCourses.map((course) => {
                  const progress = Number(courseProgressPercentMap[String(course.id)] ?? 0);
                  const pricingLabel = course.pricing_type || (Number(course.price) === 0 ? 'Free for Members' : 'Paid');
                  const isBookmarked = bookmarkedCourseIds.includes(String(course.id));
                  return (
                    <div key={course.id} className="col-12 col-sm-6 col-lg-4 col-xl-3">
                      <button
                        type="button"
                        className="border rounded-4 p-3 h-100 bg-white text-start w-100 student-course-card position-relative"
                        onClick={() => navigate(`/dashboard/student-course/${course.id}`)}
                      >
                        <span
                          role="button"
                          tabIndex={0}
                          className={`student-bookmark-btn ${isBookmarked ? 'active' : ''}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleBookmarkCourse(course.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              toggleBookmarkCourse(course.id);
                            }
                          }}
                          aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
                        >
                        {isBookmarked ? <i className="bi bi-bookmark-star-fill"></i> : <i className="bi bi-bookmark-plus"></i>}                        </span>
                        <div
                          className="rounded-3 mb-3 d-flex align-items-center justify-content-center text-white fw-semibold student-course-thumb"
                          style={{
                            background: (courseFirstVideoThumbMap[String(course.id)] || course.thumbnail_url)
                              ? `url(${courseFirstVideoThumbMap[String(course.id)] || course.thumbnail_url}) center/cover no-repeat`
                              : 'linear-gradient(135deg,#3f64e0,#6e8dff)',
                          }}
                        >
                          {!(courseFirstVideoThumbMap[String(course.id)] || course.thumbnail_url) && (
                            <span className="px-2 text-center">{course.title || 'Course'}</span>
                          )}
                        </div>
                        <h6 className="fw-bold mb-1">{course.title || '-'}</h6>
                        <p className="text-muted small mb-2">{course.description || 'No description available.'}</p>
                        <div className="small mb-3">
                          <span className="badge rounded-pill text-bg-light me-1">{course.delivery_mode || 'Recorded'}</span>
                          <span className="badge rounded-pill text-bg-light">{pricingLabel}</span>
                        </div>
                        <div className="progress mb-2 student-progress-track" style={{ height: 8 }}>
                          <div className="progress-bar" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <p className="small mb-0 text-muted">{progress}% Complete</p>
                          <span className="small fw-semibold text-primary">Start</span>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {!isLoading && hasMoreCourses && (
              <div className="text-center pt-3">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm rounded-pill px-4"
                  onClick={() => setVisibleCourseCount((prev) => Math.min(prev + COURSE_PAGE_SIZE, displayedCourses.length))}
                >
                  Load more
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </StudentDashboardSectionPage>
  );
}

