import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardSectionPage from './DashboardSectionPage';
import CommunityVideoPlayer from '../../components/CommunityVideoPlayer.jsx';
import CourseAdaptiveVideo from '../../components/CourseAdaptiveVideo.jsx';
import { resolvePublicMediaUrl } from '../../utils/mediaUrl';

const normalizeCourseType = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const isOwningManhattanCourse = (entry) => normalizeCourseType(entry?.course_type) === 'owningmanhattan';

const getStoredJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

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

const resolvePlayableUrl = (video) =>
  video?.video_url || video?.video_data_url || video?.session_video_url || '';

const isVideoContent = (video) => String(video?.content_type || 'video').toLowerCase() === 'video';

const catalogBackPath = '/dashboard/course-management?type=owning-manhattan';

export default function AdminOwningManhattanDetailPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5003').replace(/\/$/, ''),
    [],
  );

  const omReturnPath = `/dashboard/owning-manhattan/${courseId}`;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session missing. Please login first.');
      navigate('/login');
      return;
    }

    const run = async () => {
      setIsLoading(true);
      setError('');
      try {
        const courseRes = await fetch(`${apiBaseUrl}/api/courses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const coursePayload = await courseRes.json();
        if (courseRes.status === 401 || courseRes.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
          return;
        }
        if (!courseRes.ok || coursePayload.status !== 'success') {
          throw new Error(coursePayload.message || 'Failed to load course.');
        }
        const current = (coursePayload.data || []).find((entry) => String(entry.id) === String(courseId));
        if (!current) {
          throw new Error('Catalog entry not found.');
        }
        if (!isOwningManhattanCourse(current)) {
          setCourse(null);
          setVideos([]);
          setError(
            'This page is only for Owning Manhattan catalog entries. Use course management for other course types.',
          );
          return;
        }
        setCourse(current);

        const videoRes = await fetch(`${apiBaseUrl}/api/courses/${courseId}/videos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const videoPayload = await videoRes.json();
        if (!videoRes.ok || videoPayload.status !== 'success') {
          setVideos(getStoredJson(`course_videos_${courseId}`, []));
        } else {
          setVideos(videoPayload.data || []);
        }
      } catch (e) {
        setError(e.message || 'Failed to load.');
        setCourse(null);
        setVideos([]);
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [apiBaseUrl, courseId, navigate]);

  const user = getStoredJson('user', {});
  const roleName = (user?.role_name || user?.role || '').toLowerCase();
  const canManageVideos = roleName === 'admin' || roleName === 'ceo';

  const openVideoAdmin = (video) => {
    navigate(`/dashboard/course-management/${courseId}/videos/${video.id}`, {
      state: { omAdminReturnPath: omReturnPath },
    });
  };

  const heroThumbVideo = videos.find((v) => v.thumbnail_url || v.thumbnail_data_url);
  const heroThumbRaw = heroThumbVideo?.thumbnail_url || heroThumbVideo?.thumbnail_data_url || '';
  const heroThumbSrc = resolvePublicMediaUrl(heroThumbRaw, apiBaseUrl);

  const renderVideoPreview = (video) => {
    const url = resolvePlayableUrl(video);
    if (!url) {
      return (
        <div className="text-muted small py-4 text-center">
          {video.processing_status === 'processing' ? 'Video is processing…' : 'No playable URL yet.'}
        </div>
      );
    }
    if (!isVideoContent(video)) {
      return (
        <div className="p-3 text-center">
          <a href={url} target="_blank" rel="noopener noreferrer" className="small text-white">
            Open media
          </a>
        </div>
      );
    }
    if (/\.m3u8(\?|$)/i.test(url)) {
      return (
        <CourseAdaptiveVideo
          src={url}
          controls
          style={{ width: '100%', maxHeight: 240, background: '#000' }}
        />
      );
    }
    return (
      <CommunityVideoPlayer
        src={url}
        title={video.title || 'Video'}
        variants={video.video_variants || []}
        autoQualityLabel="Original"
        className="w-100"
      />
    );
  };

  const pageTitle = course?.title ? `${course.title} · Owning Manhattan` : 'Owning Manhattan';

  return (
    <DashboardSectionPage title={pageTitle}>
      <div className="container-fluid px-0 lms-om-admin-page" style={{ maxWidth: 1140 }}>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <Link to={catalogBackPath} className="btn btn-outline-secondary btn-sm">
            ← Back to Owning Manhattan catalog
          </Link>
          {course && canManageVideos ? (
            <Link
              to={`/dashboard/course-management/${courseId}`}
              className="btn btn-outline-primary btn-sm"
            >
              Full course editor
            </Link>
          ) : null}
        </div>

        {error ? (
          <div className="alert alert-warning border-0 shadow-sm mb-3">
            <p className="mb-2">{error}</p>
            {!isLoading && !course ? (
              <Link to={catalogBackPath} className="btn btn-sm btn-primary">
                Return to catalog
              </Link>
            ) : null}
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-muted py-5 text-center">Loading…</p>
        ) : course ? (
          <>
            <div className="lms-om-admin-hero lms-card p-4 p-md-5 mb-3">
              <div className="row g-4 align-items-center">
                <div className="col-lg-8">
                  <p className="lms-om-admin-eyebrow mb-0">Catalog entry</p>
                  <h1 className="h3 fw-bold mb-2 mt-1">{course.title || 'Untitled'}</h1>
                  <p className="text-muted mb-3" style={{ maxWidth: '36rem', lineHeight: 1.55 }}>
                    {course.description || 'No description.'}
                  </p>
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <span className="badge rounded-pill text-bg-primary">Owning Manhattan</span>
                    <span
                      className={`badge rounded-pill ${(course.delivery_mode || 'Recorded') === 'Live' ? 'text-bg-warning' : 'text-bg-secondary'}`}
                    >
                      {course.delivery_mode || 'Recorded'}
                    </span>
                    <span
                      className={`badge rounded-pill ${((course.pricing_type || '').toLowerCase() === 'free for members' || Number(course.price) === 0) ? 'text-bg-success' : 'text-bg-danger'}`}
                    >
                      {course.pricing_type || (Number(course.price) === 0 ? 'Free for Members' : 'Paid')}
                    </span>
                    <span className="badge rounded-pill text-bg-light border">
                      {Number(course.price) === 0 ? 'Free' : formatPrice(course.price)}
                    </span>
                    <span className="text-muted small">Added {formatDate(course.created_at)}</span>
                  </div>
                </div>
                {heroThumbSrc ? (
                  <div className="col-lg-4 text-lg-end">
                    <img
                      src={heroThumbSrc}
                      alt=""
                      className="rounded-3 border shadow-sm"
                      style={{ maxWidth: '100%', width: 320, height: 'auto', objectFit: 'cover' }}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="lms-om-admin-catalog lms-card p-4 mb-3">
              <h2 className="h5 fw-bold mb-3">Episodes and media</h2>
              {videos.length === 0 ? (
                <p className="text-muted mb-0">
                  No videos attached yet. Use full course editor to upload or attach media.
                </p>
              ) : (
                <div className="row g-3">
                  {videos.map((video) => (
                    <div key={video.id} className="col-12">
                      <div className="border rounded-3 p-3 p-md-4 bg-light bg-opacity-50">
                        <div className="row g-3 align-items-start">
                          <div className="col-12 col-md-7">
                            <div className="rounded-3 overflow-hidden bg-black" style={{ maxHeight: 280 }}>
                              {renderVideoPreview(video)}
                            </div>
                          </div>
                          <div className="col-12 col-md-5">
                            <h3 className="h6 fw-bold">{video.title || 'Untitled video'}</h3>
                            <p className="small text-muted mb-2">
                              {video.short_description || video.description || '—'}
                            </p>
                            <div className="d-flex flex-wrap gap-2 mb-3">
                              <span
                                className={`badge ${Number(video.is_active) === 0 ? 'text-bg-secondary' : 'text-bg-success'}`}
                              >
                                {Number(video.is_active) === 0 ? 'Inactive' : 'Active'}
                              </span>
                              {video.processing_status && video.processing_status !== 'ready' ? (
                                <span className="badge text-bg-warning text-dark">{video.processing_status}</span>
                              ) : null}
                              {Array.isArray(video.video_variants) && video.video_variants.length > 0 ? (
                                <span className="badge text-bg-info">
                                  {video.video_variants.length} quality option
                                  {video.video_variants.length === 1 ? '' : 's'}
                                </span>
                              ) : null}
                            </div>
                            {canManageVideos ? (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm rounded-pill"
                                onClick={() => openVideoAdmin(video)}
                              >
                                Manage video
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </DashboardSectionPage>
  );
}
