import { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { useNavigate, useLocation } from 'react-router-dom';
import { FiBookmark, FiHeart, FiMessageCircle, FiMoreHorizontal } from 'react-icons/fi';
import StudentDashboardSectionPage from './StudentDashboardSectionPage';
import SignatureCoursePreviewModal from '../../components/SignatureCoursePreviewModal';
import { resolvePublicMediaUrl } from '../../utils/mediaUrl';
import owningManhattanBanner from '../../assets/OwningManhattanBanner.png';

const COURSE_PAGE_SIZE = 8;
const OWNING_MANHATTAN_COURSE_TYPE = 'OwningManhattan';
const OWNING_MANHATTAN_SORT_OPTIONS = [
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'latest', label: 'Latest' },
  { value: 'likes', label: 'Likes' },
  { value: 'new-activity', label: 'New activity' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'popular', label: 'Popular' },
  { value: 'new-post', label: 'New post' },
  { value: 'working', label: 'Working' },
];

const isOwningManhattanCatalogCourse = (course) =>
  String(course?.course_type || '')
    .replace(/\s+/g, '')
    .toLowerCase() === 'owningmanhattan';

const normalizeOwningManhattanRecordedType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'short courses' || normalized === 'short course') return 'Short Course';
  if (normalized === 'podcast episode' || normalized === 'podcast episodes') return 'Podcast Episode';
  return 'Short Course';
};

const getCourseLikeCount = (course) =>
  Number(course?.likes_count ?? course?.like_count ?? course?.total_likes ?? course?.likes ?? 0) || 0;

const getCourseCommentCount = (course) =>
  Number(course?.comments_count ?? course?.comment_count ?? course?.total_comments ?? course?.comments ?? 0) || 0;

const isShortCourse = (course) => {
  const courseType = String(course?.course_type || '').toLowerCase();
  const recordedType = String(course?.recorded_type || '').toLowerCase();
  return courseType.includes('short') || recordedType.includes('short');
};

/** Signature / long-form: recorded programs only (excludes shorts, live workshops, Owning Manhattan). */
const isLongVideoSignatureCourse = (course) => {
  if (isOwningManhattanCatalogCourse(course)) return false;
  if (isShortCourse(course)) return false;
  return String(course?.delivery_mode || 'Recorded').toLowerCase() !== 'live';
};

export default function StudentPanel({ variant = 'signature' }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const owningManhattanOnly =
    variant === 'owning-manhattan' || pathname.includes('student-owning-manhattan');
  const startHereStarterMode =
    variant === 'start-here-starter' || pathname.includes('student-start-here-starter');
  const [courses, setCourses] = useState([]);
  const [courseFirstVideoThumbMap, setCourseFirstVideoThumbMap] = useState({});
  const [courseFirstLessonVideoMap, setCourseFirstLessonVideoMap] = useState({});
  const [courseProgressPercentMap, setCourseProgressPercentMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [headerSearch, setHeaderSearch] = useState('');
  const [owningManhattanSort, setOwningManhattanSort] = useState('oldest');
  const [visibleCourseCount, setVisibleCourseCount] = useState(COURSE_PAGE_SIZE);
  const [previewCourse, setPreviewCourse] = useState(null);
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
    () => getApiBaseUrl(),
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
        const coursesPath = owningManhattanOnly
          ? `/api/courses?course_type=${encodeURIComponent(OWNING_MANHATTAN_COURSE_TYPE)}`
          : '/api/courses';
        const response = await fetch(`${apiBaseUrl}${coursesPath}`, {
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
                return [String(course.id), { thumb: '', progress: 0, firstVideo: null }];
              }
              const courseVideos = videoPayload.data || [];
              const firstPlayableVideo =
                courseVideos.find((v) => String(v.content_type || 'video').toLowerCase() === 'video') || null;
              const thumbVideo =
                courseVideos.find((v) => v.thumbnail_url || v.thumbnail_data_url) || courseVideos[0] || null;
              const firstThumb = thumbVideo?.thumbnail_url || thumbVideo?.thumbnail_data_url || '';
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
              return [String(course.id), { thumb: firstThumb, progress: progressPercent, firstVideo: firstPlayableVideo }];
            } catch {
              return [String(course.id), { thumb: '', progress: 0, firstVideo: null }];
            }
          }),
        );
        const nextThumbMap = {};
        const nextProgressMap = {};
        const nextFirstLessonMap = {};
        courseMetaEntries.forEach(([courseKey, meta]) => {
          nextThumbMap[courseKey] = meta?.thumb || '';
          nextProgressMap[courseKey] = Number(meta?.progress || 0);
          nextFirstLessonMap[courseKey] = meta?.firstVideo ?? null;
        });
        setCourseFirstVideoThumbMap(nextThumbMap);
        setCourseFirstLessonVideoMap(nextFirstLessonMap);
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
  }, [apiBaseUrl, owningManhattanOnly]);

  useEffect(() => {
    if (owningManhattanOnly) setActiveTab('all');
  }, [owningManhattanOnly]);

  useEffect(() => {
    if (owningManhattanOnly) setOwningManhattanSort('oldest');
  }, [owningManhattanOnly]);

  useEffect(() => {
    if (!owningManhattanOnly && activeTab === 'short') setActiveTab('all');
  }, [owningManhattanOnly, activeTab]);

  const catalogCourses = useMemo(() => {
    if (owningManhattanOnly) return courses.filter((course) => isOwningManhattanCatalogCourse(course));
    return courses.filter((course) => isLongVideoSignatureCourse(course));
  }, [courses, owningManhattanOnly]);

  const savedMyCourseIds = (() => {
    try {
      const raw = localStorage.getItem('student_my_course_ids');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  })();

  const myCourses = catalogCourses.filter((course) => {
    if (savedMyCourseIds.length > 0) return savedMyCourseIds.includes(String(course.id));
    return Number(course.price) === 0;
  });

  const bookmarkedCourses = useMemo(
    () => catalogCourses.filter((course) => bookmarkedCourseIds.includes(String(course.id))),
    [catalogCourses, bookmarkedCourseIds],
  );

  const displayedCourses = useMemo(() => {
    const baseCourses = owningManhattanOnly
      ? activeTab === 'podcast'
        ? catalogCourses.filter(
            (course) => normalizeOwningManhattanRecordedType(course.recorded_type) === 'Podcast Episode',
          )
        : activeTab === 'short'
          ? catalogCourses.filter(
              (course) => normalizeOwningManhattanRecordedType(course.recorded_type) === 'Short Course',
            )
          : catalogCourses
      : startHereStarterMode
        ? catalogCourses
      : activeTab === 'my'
        ? myCourses
        : activeTab === 'bookmarks'
          ? bookmarkedCourses
          : catalogCourses;
    const query = headerSearch.trim().toLowerCase();
    const filteredCourses = !query ? baseCourses : baseCourses.filter((course) => {
      const title = String(course.title || '').toLowerCase();
      const description = String(course.description || '').toLowerCase();
      const mode = String(course.delivery_mode || '').toLowerCase();
      return title.includes(query) || description.includes(query) || mode.includes(query);
    });
    if (!owningManhattanOnly) return filteredCourses;

    const parseSortableDate = (value) => {
      const time = value ? new Date(value).getTime() : 0;
      return Number.isFinite(time) ? time : 0;
    };

    const getCreatedAt = (course) =>
      parseSortableDate(course.created_at || course.createdAt || course.publish_date || course.published_at);
    const getUpdatedAt = (course) =>
      parseSortableDate(course.updated_at || course.updatedAt || course.modified_at || course.last_activity_at) ||
      getCreatedAt(course);
    const getLikes = (course) =>
      Number(course.likes_count ?? course.like_count ?? course.total_likes ?? course.likes ?? 0) || 0;
    const getPopularity = (course) =>
      Number(course.popularity_score ?? course.view_count ?? course.views ?? getLikes(course)) || 0;

    const sortedCourses = [...filteredCourses];
    sortedCourses.sort((left, right) => {
      if (owningManhattanSort === 'alphabetical') {
        return String(left.title || '').localeCompare(String(right.title || ''));
      }
      if (owningManhattanSort === 'latest' || owningManhattanSort === 'new-post') {
        return getCreatedAt(right) - getCreatedAt(left) || Number(right.id || 0) - Number(left.id || 0);
      }
      if (owningManhattanSort === 'likes') {
        return getLikes(right) - getLikes(left) || Number(right.id || 0) - Number(left.id || 0);
      }
      if (owningManhattanSort === 'new-activity' || owningManhattanSort === 'working') {
        return getUpdatedAt(right) - getUpdatedAt(left) || Number(right.id || 0) - Number(left.id || 0);
      }
      if (owningManhattanSort === 'popular') {
        return getPopularity(right) - getPopularity(left) || Number(right.id || 0) - Number(left.id || 0);
      }
      return getCreatedAt(left) - getCreatedAt(right) || Number(left.id || 0) - Number(right.id || 0);
    });
    return sortedCourses;
  }, [
    activeTab,
    catalogCourses,
    myCourses,
    bookmarkedCourses,
    headerSearch,
    owningManhattanOnly,
    owningManhattanSort,
    startHereStarterMode,
  ]);

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

  const navigateToStudentCourse = (course) => {
    navigate(
      owningManhattanOnly
        ? `/dashboard/student-course/${course.id}?from=owning-manhattan&view=player`
        : startHereStarterMode
          ? `/dashboard/student-course/${course.id}?from=start-here&view=player`
          : `/dashboard/student-course/${course.id}`,
    );
  };

  return (
    <StudentDashboardSectionPage
      title={
        owningManhattanOnly
          ? 'Owning Manhattan'
          : startHereStarterMode
            ? 'Start Here'
            : 'Signature Courses'
      }
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
          {!owningManhattanOnly && !startHereStarterMode && (
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
                className={`btn btn-sm ${activeTab === 'bookmarks' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('bookmarks')}
              >
                Bookmarks
              </button>
            </div>
          </div>
          )}
          <div className={` ${owningManhattanOnly ? 'student-om-shell' : ''}`}>
            {isLoading ? (
              <div className="text-center py-5 text-muted">Loading courses...</div>
            ) : displayedCourses.length === 0 ? (
              <div className="text-center py-5 text-muted">
                {activeTab === 'my'
                  ? 'No courses in My Courses yet.'
                  : activeTab === 'bookmarks'
                      ? 'No bookmarked courses yet.'
                      : owningManhattanOnly
                        ? 'No Owning Manhattan courses yet.'
                        : 'No courses available.'}
              </div>
            ) : owningManhattanOnly ? (
              <>
                <section className="student-om-page">
                  <div className="student-om-toolbar">
                    <div className="student-om-heading">
                      <div>
                        <h2>Owning Manhattan</h2>
                      </div>
                    </div>
                    <div className="student-om-toolbar-actions">
                      <label className="student-om-sort-wrap">
                        <select
                          className="student-om-sort-chip"
                          value={owningManhattanSort}
                          onChange={(event) => setOwningManhattanSort(event.target.value)}
                          aria-label="Sort Owning Manhattan episodes"
                        >
                          {OWNING_MANHATTAN_SORT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div
                    className="student-om-hero"
                    role="button"
                    tabIndex={0}
                    onClick={() => visibleCourses[0] && navigateToStudentCourse(visibleCourses[0])}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && visibleCourses[0]) {
                        event.preventDefault();
                        navigateToStudentCourse(visibleCourses[0]);
                      }
                    }}
                    style={{
                      background: ` url(${owningManhattanBanner}) center/cover no-repeat`,
                    }}
                  >
                  </div>

                  <div className="student-om-filter-row" role="tablist" aria-label="Owning Manhattan filters">
                    <button
                      type="button"
                      className={`student-om-filter-pill ${activeTab === 'all' ? 'active' : ''}`}
                      onClick={() => setActiveTab('all')}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={`student-om-filter-pill ${activeTab === 'short' ? 'active' : ''}`}
                      onClick={() => setActiveTab('short')}
                    >
                      Short Course
                    </button>
                    <button
                      type="button"
                      className={`student-om-filter-pill ${activeTab === 'podcast' ? 'active' : ''}`}
                      onClick={() => setActiveTab('podcast')}
                    >
                      Podcast Episode
                    </button>
                  </div>

                  <div className="student-om-grid">
                    {visibleCourses.map((course) => {
                      const progress = Number(courseProgressPercentMap[String(course.id)] ?? 0);
                      const isBookmarked = bookmarkedCourseIds.includes(String(course.id));
                      const recordedType = normalizeOwningManhattanRecordedType(course.recorded_type);
                      const thumbSrc = resolvePublicMediaUrl(
                        courseFirstVideoThumbMap[String(course.id)] ||
                          course.thumbnail_url ||
                          course.thumbnail_data_url ||
                          '',
                        apiBaseUrl,
                      );
                      return (
                        <button
                          key={course.id}
                          type="button"
                          className="student-om-card"
                          onClick={() => navigateToStudentCourse(course)}
                        >
                          <span
                            role="button"
                            tabIndex={0}
                            className={`student-om-bookmark ${isBookmarked ? 'active' : ''}`}
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
                            <FiBookmark />
                          </span>
                          <span className="student-om-card-more" aria-hidden="true">
                            <FiMoreHorizontal />
                          </span>
                          <div
                            className="student-om-card-media"
                            style={{
                              background: thumbSrc
                                ? `linear-gradient(180deg, rgba(7, 10, 24, 0.08), rgba(7, 10, 24, 0.74)), url(${thumbSrc}) center/cover no-repeat`
                                : 'linear-gradient(140deg, #030303, #111827 48%, #161616)',
                            }}
                          >
                            {!thumbSrc && (
                              <div className="student-om-card-wordmark">
                                <span>OWNING</span>
                                <span>MANHATTAN</span>
                              </div>
                            )}
                            <span className="student-om-card-type">{recordedType}</span>
                          </div>
                          <div className="student-om-card-body">
                            <span className="student-om-card-kicker">{recordedType}</span>
                            <h3>{course.title || 'Untitled episode'}</h3>
                            <p>{course.description || 'Watch the latest Owning Manhattan lesson crafted for members.'}</p>
                            <div className="student-om-card-stats">
                              <span>
                                <FiHeart />
                                {getCourseLikeCount(course)}
                              </span>
                              <span>
                                <FiMessageCircle />
                                {getCourseCommentCount(course)}
                              </span>
                            </div>
                            {/* <div className="student-om-progress">
                              <div className="student-om-progress-bar" style={{ width: `${progress}%` }} />
                            </div>
                            <div className="student-om-card-footer">
                              <span>{progress}% complete</span>
                              <strong>Watch now</strong>
                            </div> */}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </>
            ) : (
              <div className="row g-3">
                {visibleCourses.map((course) => {
                  const progress = Number(courseProgressPercentMap[String(course.id)] ?? 0);
                  const pricingLabel = course.pricing_type || (Number(course.price) === 0 ? 'Free for Members' : 'Paid');
                  const isBookmarked = bookmarkedCourseIds.includes(String(course.id));
                  const thumbSrc = resolvePublicMediaUrl(
                    courseFirstVideoThumbMap[String(course.id)] || course.thumbnail_url || '',
                    apiBaseUrl,
                  );
                  return (
                    <div key={course.id} className="col-12 col-sm-6 col-lg-4 col-xl-3">
                      <button
                        type="button"
                        className="border rounded-4 p-3 h-100 bg-white text-start w-100 student-course-card position-relative"
                        onClick={() =>
                          owningManhattanOnly || startHereStarterMode
                            ? navigateToStudentCourse(course)
                            : setPreviewCourse(course)
                        }
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
                            background: thumbSrc
                              ? `url(${thumbSrc}) center/cover no-repeat`
                              : 'linear-gradient(135deg,#3f64e0,#6e8dff)',
                          }}
                        >
                          {!thumbSrc && (
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

      {!owningManhattanOnly && !startHereStarterMode && (
        <SignatureCoursePreviewModal
          open={Boolean(previewCourse)}
          course={previewCourse}
          firstVideo={
            previewCourse ? courseFirstLessonVideoMap[String(previewCourse.id)] || null : null
          }
          heroImageUrl={
            previewCourse ? courseFirstVideoThumbMap[String(previewCourse.id)] || previewCourse.thumbnail_url || '' : ''
          }
          apiBaseUrl={apiBaseUrl}
          isBookmarked={previewCourse ? bookmarkedCourseIds.includes(String(previewCourse.id)) : false}
          onClose={() => setPreviewCourse(null)}
          onStartCourse={() => {
            if (!previewCourse) return;
            navigateToStudentCourse(previewCourse);
            setPreviewCourse(null);
          }}
          onToggleBookmark={(courseId) => toggleBookmarkCourse(courseId)}
        />
      )}
    </StudentDashboardSectionPage>
  );
}
