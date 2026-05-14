import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import TrainerDashboardSectionPage from './TrainerDashboardSectionPage';
import CommunityVideoPlayer from '../../components/CommunityVideoPlayer.jsx';
import CourseAdaptiveVideo from '../../components/CourseAdaptiveVideo.jsx';
import { resolvePublicMediaUrl } from '../../utils/mediaUrl';

export default function TrainerCourseDetailPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const fromOwningManhattan = new URLSearchParams(search).get('from') === 'owning-manhattan';
  const coursesListPath = fromOwningManhattan
    ? '/dashboard/trainer-owning-manhattan'
    : '/dashboard/trainer-course';
  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5003').replace(/\/$/, ''),
    [],
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session missing. Please login first.');
      navigate('/login');
      return;
    }

    const fetchCourse = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${apiBaseUrl}/api/courses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') {
          throw new Error(payload.message || 'Unable to fetch course detail');
        }
        const current = (payload.data || []).find((entry) => String(entry.id) === String(courseId));
        if (!current) throw new Error('Course not found.');
        setCourse(current);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchVideos = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/courses/${courseId}/videos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') {
          throw new Error(payload.message || 'Unable to fetch videos');
        }
        setVideos(payload.data || []);
      } catch (fetchError) {
        setError(fetchError.message);
      }
    };

    fetchCourse();
    fetchVideos();
  }, [apiBaseUrl, courseId, navigate]);

  const formatDate = (input) => {
    if (!input) return '-';
    return new Date(input).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const resolvePlayableUrl = (video) => video.video_url || video.video_data_url || video.session_video_url || '';
  const isVideoContent = (video) => String(video?.content_type || 'video').toLowerCase() === 'video';
  const openPreview = (video) => {
    const url = resolvePlayableUrl(video);
    if (!url) return;
    if (!isVideoContent(video)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setActiveVideo(video);
    setShowPlayerModal(true);
  };

  return (
    <TrainerDashboardSectionPage title="Course Details">
      <div className="container-fluid px-0" style={{ maxWidth: 1200 }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Link to={coursesListPath} className="btn btn-outline-secondary btn-sm">
            {fromOwningManhattan ? 'Back to Owning Manhattan' : 'Back to Trainer Courses'}
          </Link>
        </div>

        {error && <div className="alert alert-danger mb-3">{error}</div>}

        <div
          className="lms-card p-4 p-md-5 mb-3 text-white border-0"
          style={{
            background: 'linear-gradient(120deg,#071d3d,#0d2f69 45%,#0a5dea)',
            boxShadow: '0 18px 45px rgba(7,29,61,0.35)',
          }}
        >
          {isLoading ? (
            <p className="mb-0">Loading course detail...</p>
          ) : (
            <>
              <p className="text-uppercase small mb-1 text-light">Trainer Course Overview</p>
              <h1 className="h2 fw-bold mb-1">{course?.title || 'Course Detail'}</h1>
              <p className="mb-2 text-light">{course?.description || '-'}</p>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <span className="badge bg-light text-dark px-3 py-2">Mode: {course?.delivery_mode || '-'}</span>
                <span className="badge bg-light text-dark px-3 py-2">Type: {course?.course_type || course?.recorded_type || '-'}</span>
                <span className="badge bg-light text-dark">
                  Pricing: {course?.pricing_type || (Number(course?.price) === 0 ? 'Free for Members' : 'Paid')}
                </span>
              </div>
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <div className="rounded-3 p-3 h-100" style={{ background: 'rgba(255,255,255,0.13)' }}>
                    <p className="small text-uppercase mb-1 text-light">Total Videos</p>
                    <h3 className="h4 mb-0 fw-bold">{videos.length}</h3>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="rounded-3 p-3 h-100" style={{ background: 'rgba(255,255,255,0.13)' }}>
                    <p className="small text-uppercase mb-1 text-light">Course Type</p>
                    <h3 className="h6 mb-0 fw-bold">{course?.course_type || course?.recorded_type || '-'}</h3>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="rounded-3 p-3 h-100" style={{ background: 'rgba(255,255,255,0.13)' }}>
                    <p className="small text-uppercase mb-1 text-light">Mode</p>
                    <h3 className="h6 mb-0 fw-bold">{course?.delivery_mode || '-'}</h3>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="lms-card p-0 mb-3 overflow-hidden border-0" style={{ boxShadow: '0 10px 28px rgba(15,23,42,0.08)' }}>
          <div className="d-flex justify-content-between align-items-center p-3 border-bottom" style={{ background: 'linear-gradient(180deg,#f8fbff,#ffffff)' }}>
            <h2 className="h5 mb-0">Course Videos</h2>
            <span className="badge text-bg-dark px-3 py-2">{videos.length} videos</span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-4">Title</th>
                  <th>Lesson</th>
                  <th>Description</th>
                  <th>Trainer</th>
                  <th>Preview</th>
                  <th>Uploaded On</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {videos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-5 text-muted">No videos available for this course.</td>
                  </tr>
                ) : (
                  videos.map((video) => (
                    <tr key={video.id}>
                      <td className="ps-4 fw-semibold">{video.title}</td>
                      <td>{video.lesson_title || '-'}</td>
                      <td>{video.short_description || video.description || '-'}</td>
                      <td>{video.assigned_trainer_name || '-'}</td>
                      <td>
                        {resolvePlayableUrl(video) ? (
                          <button
                            type="button"
                            className="btn p-0 border-0 bg-transparent position-relative"
                            onClick={() => openPreview(video)}
                            title={isVideoContent(video) ? 'Play video' : 'Open file'}
                          >
                            {isVideoContent(video) ? (
                              <>
                                <img
                                  src={resolvePublicMediaUrl(video.thumbnail_url || video.thumbnail_data_url || '', apiBaseUrl) || 'https://via.placeholder.com/200x112?text=Video'}
                                  alt={video.thumbnail_name || `${video.title} thumbnail`}
                                  style={{ width: 200, height: 112, objectFit: 'cover', borderRadius: 8 }}
                                />
                                <span
                                  className="position-absolute top-50 start-50 translate-middle rounded-circle d-flex align-items-center justify-content-center"
                                  style={{ width: 44, height: 44, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 18 }}
                                >
                                  ▶
                                </span>
                              </>
                            ) : (
                              <span className="btn btn-sm btn-outline-primary">Open File</span>
                            )}
                          </button>
                        ) : (
                          <span className="small text-muted">Preview unavailable</span>
                        )}
                      </td>
                      <td>{formatDate(video.created_at)}</td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => navigate(`/dashboard/trainer-course-video-detail/${courseId}/${video.id}`)}>
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

        {showPlayerModal && activeVideo && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ background: 'rgba(15,23,42,0.75)', zIndex: 1500 }}>
            <div className="card border-0 shadow-lg" style={{ width: '100%', maxWidth: 900 }}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>{activeVideo.title}</strong>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowPlayerModal(false)}>
                  Close
                </button>
              </div>
              <div className="card-body p-0 bg-black position-relative">
                {(() => {
                  const playUrl = resolvePlayableUrl(activeVideo);
                  if (!playUrl) return null;
                  if (/\.m3u8(\?|$)/i.test(playUrl)) {
                    return (
                      <CourseAdaptiveVideo
                        src={playUrl}
                        controls
                        autoPlay
                        style={{ width: '100%', maxHeight: '70vh' }}
                      />
                    );
                  }
                  return (
                    <CommunityVideoPlayer
                      src={playUrl}
                      title={activeVideo.title || 'Lesson'}
                      variants={activeVideo.video_variants || []}
                      autoQualityLabel="Original"
                      autoPlay
                      className="w-100"
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </TrainerDashboardSectionPage>
  );
}

