import { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardSectionPage from './DashboardSectionPage';
import CommunityVideoPlayer from '../../components/CommunityVideoPlayer.jsx';
import CourseAdaptiveVideo from '../../components/CourseAdaptiveVideo.jsx';
import { resolvePublicMediaUrl } from '../../utils/mediaUrl';

const STANDARD_RECORDED_TYPE_OPTIONS = ['Chapter Wise/Topic Wise', 'Short Course'];
const OWNING_MANHATTAN_RECORDED_TYPE_OPTIONS = ['Short Course', 'Podcast Episode'];

const getRecordedTypeOptions = (courseType) =>
  courseType === 'OwningManhattan'
    ? OWNING_MANHATTAN_RECORDED_TYPE_OPTIONS
    : STANDARD_RECORDED_TYPE_OPTIONS;

const TRAINER_UPLOAD_PERMISSION_KEY = 'course_trainer_upload_permissions';

const getStoredJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [openLessonSections, setOpenLessonSections] = useState({});
  const [trainers, setTrainers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showCourseEditModal, setShowCourseEditModal] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    price: '',
    deliveryMode: 'Recorded',
    recordedType: 'Chapter Wise/Topic Wise',
    pricingType: 'Paid',
    courseType: 'Chapter Wise Course',
  });
  const [videoForm, setVideoForm] = useState({
    title: '',
    shortDescription: '',
    description: '',
    contentType: 'video',
    videoFile: null,
    thumbnailFile: null,
    assignedTrainerId: '',
    lessonId: '',
  });
  const [lessonForm, setLessonForm] = useState({
    title: '',
  });
  const [isTrainerUploadAllowed, setIsTrainerUploadAllowed] = useState(false);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [editingVideo, setEditingVideo] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    shortDescription: '',
    description: '',
    assignedTrainerId: '',
    lessonId: '',
  });
  const [uploadProgress, setUploadProgress] = useState({
    visible: false,
    percent: 0,
    title: '',
    stage: '',
    error: '',
  });

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  const user = getStoredJson('user', {});
  const roleName = (user?.role_name || user?.role || '').toLowerCase();
  const canManageVideos = roleName === 'admin' || roleName === 'ceo';

  useEffect(() => {
    const permissions = getStoredJson(TRAINER_UPLOAD_PERMISSION_KEY, {});
    setIsTrainerUploadAllowed(Boolean(permissions[courseId]));
  }, [courseId]);

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
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          throw new Error('Session expired or unauthorized. Please login again.');
        }
        if (!response.ok || payload.status !== 'success') {
          throw new Error(payload.message || 'Failed to fetch course detail');
        }
        const current = (payload.data || []).find((entry) => String(entry.id) === String(courseId));
        if (!current) {
          throw new Error('Course not found.');
        }
        setCourse(current);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchTrainers = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') {
          return;
        }
        const trainerList = (payload.data || []).filter((entry) => {
          const role = (entry.role_name || entry.role || '').toLowerCase();
          return role === 'instructor' || role === 'trainer';
        });
        setTrainers(trainerList);
      } catch {
        setTrainers([]);
      }
    };

    const fetchCourseVideos = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/courses/${courseId}/videos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') {
          const localVideos = getStoredJson(`course_videos_${courseId}`, []);
          setVideos(localVideos);
          return;
        }
        setVideos(payload.data || []);
      } catch {
        const localVideos = getStoredJson(`course_videos_${courseId}`, []);
        setVideos(localVideos);
      }
    };

    const fetchLessons = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/courses/${courseId}/lessons`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') {
          setLessons([]);
          return;
        }
        setLessons(payload.data || []);
      } catch {
        setLessons([]);
      }
    };

    fetchCourse();
    fetchTrainers();
    fetchLessons();
    fetchCourseVideos();
  }, [apiBaseUrl, courseId, navigate]);

  const persistVideos = (nextVideos) => {
    setVideos(nextVideos);
    localStorage.setItem(`course_videos_${courseId}`, JSON.stringify(nextVideos));
  };

  const uploadSingleMedia = async (token, file, mediaLabel, progressStart, progressEnd) => {
    const formData = new FormData();
    formData.append('file', file);
    setUploadProgress((prev) => ({ ...prev, percent: progressStart, stage: `Uploading ${mediaLabel}...` }));

    const response = await fetch(`${apiBaseUrl}/api/courses/upload-media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok || payload.status !== 'success' || !payload?.data?.url) {
      throw new Error(payload.message || `Failed to upload ${mediaLabel}.`);
    }
    setUploadProgress((prev) => ({ ...prev, percent: progressEnd, stage: `${mediaLabel} uploaded.` }));
    return payload.data.url;
  };

  const handleVideoUpload = async (event) => {
    event.preventDefault();
    setFeedback('');
    setError('');

    if (!videoForm.title.trim()) {
      setError('Video title is required.');
      return;
    }
    if (!videoForm.shortDescription.trim()) {
      setError('Short description is required.');
      return;
    }
    if (!videoForm.description.trim()) {
      setError('Long description is required.');
      return;
    }
    if (!videoForm.videoFile) {
      setError('Please select a file.');
      return;
    }
    if (videoForm.contentType === 'video' && !videoForm.thumbnailFile) {
      setError('Please select a thumbnail image.');
      return;
    }
    if (!videoForm.assignedTrainerId) {
      setError('Please select a trainer.');
      return;
    }
    if (!videoForm.lessonId) {
      setError('Please select lesson.');
      return;
    }

    const assignedTrainer = trainers.find(
      (entry) => String(entry.id) === String(videoForm.assignedTrainerId),
    );

    setVideoForm({
      title: '',
      shortDescription: '',
      description: '',
      contentType: 'video',
      videoFile: null,
      thumbnailFile: null,
      assignedTrainerId: '',
      lessonId: '',
    });
    setShowVideoModal(false);
    setUploadProgress({
      visible: true,
      percent: 0,
      title: videoForm.title.trim(),
      stage: 'Starting upload...',
      error: '',
    });

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Session missing. Please login first.');

      const uploadedVideoUrl = await uploadSingleMedia(token, videoForm.videoFile, videoForm.contentType, 15, 75);
      const uploadedThumbnailUrl = videoForm.contentType === 'video'
        ? await uploadSingleMedia(token, videoForm.thumbnailFile, 'thumbnail', 80, 90)
        : null;

      const nextVideo = {
        id: crypto.randomUUID(),
        title: videoForm.title.trim(),
        short_description: videoForm.shortDescription.trim(),
        description: videoForm.description.trim(),
        video_url: uploadedVideoUrl,
        file_name: videoForm.videoFile.name,
        thumbnail_url: uploadedThumbnailUrl,
        thumbnail_name: videoForm.thumbnailFile?.name || null,
        content_type: videoForm.contentType,
        assigned_trainer_id: videoForm.assignedTrainerId,
        assigned_trainer_name: assignedTrainer?.name || 'Unknown',
        lesson_id: videoForm.lessonId,
        lesson_title: lessons.find((lesson) => String(lesson.id) === String(videoForm.lessonId))?.title || '',
        uploader_role: roleName || 'admin',
        created_at: new Date().toISOString(),
      };
      const nextVideos = [nextVideo, ...videos];
      persistVideos(nextVideos);

      const saveResponse = await fetch(`${apiBaseUrl}/api/courses/${courseId}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: nextVideo.title,
          short_description: nextVideo.short_description || null,
          description: nextVideo.description,
          video_url: nextVideo.video_url,
          thumbnail_url: nextVideo.thumbnail_url || null,
          content_type: nextVideo.content_type || 'video',
          assigned_trainer_id: nextVideo.assigned_trainer_id,
          assigned_trainer_name: nextVideo.assigned_trainer_name,
          lesson_id: nextVideo.lesson_id,
          lesson_title: nextVideo.lesson_title || null,
        }),
      });
      const savePayload = await saveResponse.json();
      if (!saveResponse.ok || savePayload.status !== 'success') {
        throw new Error(savePayload.message || 'Failed to save video details.');
      }

      setUploadProgress((prev) => ({
        ...prev,
        percent: 100,
        stage: 'Upload complete',
      }));
      setFeedback('Video uploaded successfully and URL saved to DB.');
      setTimeout(() => {
        setUploadProgress((prev) => ({ ...prev, visible: false }));
      }, 900);
    } catch (fileError) {
      setUploadProgress((prev) => ({
        ...prev,
        stage: 'Upload failed',
        error: fileError.message,
      }));
      setError(fileError.message);
    }
  };

  const handleToggleTrainerUpload = () => {
    const permissions = getStoredJson(TRAINER_UPLOAD_PERMISSION_KEY, {});
    const nextValue = !isTrainerUploadAllowed;
    permissions[courseId] = nextValue;
    localStorage.setItem(TRAINER_UPLOAD_PERMISSION_KEY, JSON.stringify(permissions));
    setIsTrainerUploadAllowed(nextValue);
    setFeedback(nextValue ? 'Trainer Panel video upload enabled.' : 'Trainer Panel video upload disabled.');
  };

  const handleCreateLesson = async (event) => {
    event.preventDefault();
    setFeedback('');
    setError('');
    const title = lessonForm.title.trim();
    if (!title) {
      setError('Lesson title is required.');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session missing. Please login first.');
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/courses/${courseId}/lessons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to create lesson.');
      }
      const createdLesson = payload.data;
      const nextLessons = [...lessons, createdLesson].sort(
        (a, b) => Number(a.lesson_order || 0) - Number(b.lesson_order || 0),
      );
      setLessons(nextLessons);
      setLessonForm({ title: '' });
      setVideoForm((prev) => ({ ...prev, lessonId: String(createdLesson.id) }));
      setShowLessonModal(false);
      setFeedback('Lesson created successfully.');
    } catch (createError) {
      setError(createError.message);
    }
  };

  const openEditModal = (video) => {
    setEditingVideo(video);
    setEditForm({
      title: video.title || '',
      shortDescription: video.short_description || '',
      description: video.description || '',
      assignedTrainerId: video.assigned_trainer_id ? String(video.assigned_trainer_id) : '',
      lessonId: video.lesson_id ? String(video.lesson_id) : '',
    });
    setShowEditModal(true);
  };

  const handleEditVideo = async (event) => {
    event.preventDefault();
    setFeedback('');
    setError('');
    if (!editingVideo) return;
    if (!editForm.title.trim()) {
      setError('Video title is required.');
      return;
    }
    if (!editForm.assignedTrainerId) {
      setError('Please select a trainer.');
      return;
    }
    if (!editForm.lessonId) {
      setError('Please select lesson.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session missing. Please login first.');
      return;
    }

    const assignedTrainer = trainers.find((entry) => String(entry.id) === String(editForm.assignedTrainerId));

    try {
      const response = await fetch(`${apiBaseUrl}/api/courses/${courseId}/videos/${editingVideo.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editForm.title.trim(),
          short_description: editForm.shortDescription.trim(),
          description: editForm.description.trim(),
          assigned_trainer_id: editForm.assignedTrainerId,
          assigned_trainer_name: assignedTrainer?.name || editingVideo.assigned_trainer_name || 'Unknown',
          lesson_id: editForm.lessonId,
          lesson_title: lessons.find((lesson) => String(lesson.id) === String(editForm.lessonId))?.title || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Failed to update video details.');
      }

      const nextVideos = videos.map((video) =>
        String(video.id) === String(editingVideo.id)
          ? {
              ...video,
              title: editForm.title.trim(),
              short_description: editForm.shortDescription.trim(),
              description: editForm.description.trim(),
              assigned_trainer_id: editForm.assignedTrainerId,
              assigned_trainer_name: assignedTrainer?.name || video.assigned_trainer_name,
              lesson_id: editForm.lessonId,
              lesson_title: lessons.find((lesson) => String(lesson.id) === String(editForm.lessonId))?.title || null,
            }
          : video,
      );
      persistVideos(nextVideos);
      setShowEditModal(false);
      setEditingVideo(null);
      setFeedback('Video details updated successfully.');
    } catch (editError) {
      setError(editError.message);
    }
  };

  const handleDeleteVideo = async (video) => {
    if (!window.confirm(`Delete "${video.title}"?`)) return;
    setFeedback('');
    setError('');
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session missing. Please login first.');
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/courses/${courseId}/videos/${video.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Failed to delete video.');
      }
      const nextVideos = videos.filter((entry) => String(entry.id) !== String(video.id));
      persistVideos(nextVideos);
      setFeedback('Video deleted successfully.');
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const openCourseEditModal = () => {
    const catalogType = course?.course_type || 'Chapter Wise Course';
    const isOmCatalog = catalogType === 'OwningManhattan';
    setCourseForm({
      title: course?.title || '',
      description: course?.description || '',
      price: String(course?.price ?? ''),
      deliveryMode: course?.delivery_mode || 'Recorded',
      recordedType:
        (isOmCatalog && course?.recorded_type === 'Short Courses'
          ? 'Short Course'
          : course?.recorded_type) || (isOmCatalog ? 'Short Course' : 'Chapter Wise/Topic Wise'),
      pricingType: course?.pricing_type || (Number(course?.price) === 0 ? 'Free for Members' : 'Paid'),
      courseType: catalogType,
    });
    setShowCourseEditModal(true);
  };

  const handleUpdateCourse = async (event) => {
    event.preventDefault();
    setFeedback('');
    setError('');
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session missing. Please login first.');
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/courses/${courseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: courseForm.title.trim(),
          description: courseForm.description.trim(),
          price: Number(courseForm.pricingType === 'Free for Members' ? 0 : courseForm.price || 0),
          delivery_mode: courseForm.deliveryMode,
          recorded_type:
            courseForm.deliveryMode === 'Recorded'
              ? courseForm.recordedType || 'Chapter Wise/Topic Wise'
              : null,
          pricing_type: courseForm.pricingType,
          free_for_members: courseForm.pricingType === 'Free for Members',
          course_type: courseForm.courseType,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Failed to update course.');
      }
      setCourse((prev) => ({
        ...prev,
        title: courseForm.title.trim(),
        description: courseForm.description.trim(),
        price: Number(courseForm.pricingType === 'Free for Members' ? 0 : courseForm.price || 0),
        delivery_mode: courseForm.deliveryMode,
        recorded_type:
          courseForm.deliveryMode === 'Recorded'
            ? courseForm.recordedType || 'Chapter Wise/Topic Wise'
            : null,
        pricing_type: courseForm.pricingType,
        course_type: courseForm.courseType,
      }));
      setShowCourseEditModal(false);
      setFeedback('Course updated successfully.');
    } catch (updateError) {
      setError(updateError.message);
    }
  };

  const handleDeleteCourse = async () => {
    if (!course) return;
    if (!window.confirm(`Delete course "${course.title}"? This will remove all lessons and videos.`)) return;
    setFeedback('');
    setError('');
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session missing. Please login first.');
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/courses/${courseId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Failed to delete course.');
      }
      navigate('/dashboard/course-management');
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const handleToggleVideoStatus = async (video) => {
    setFeedback('');
    setError('');
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session missing. Please login first.');
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/courses/${courseId}/videos/${video.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Failed to change status.');
      }
      const nextIsActive = Number(payload?.data?.is_active) === 1;
      const nextVideos = videos.map((entry) =>
        String(entry.id) === String(video.id) ? { ...entry, is_active: nextIsActive ? 1 : 0 } : entry,
      );
      persistVideos(nextVideos);
      setFeedback(nextIsActive ? 'Video activated.' : 'Video deactivated.');
    } catch (toggleError) {
      setError(toggleError.message);
    }
  };

  const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const resolvePlayableUrl = (video) => video.video_url || video.video_data_url || video.session_video_url || '';
  const isVideoContent = (video) => String(video?.content_type || 'video').toLowerCase() === 'video';
  const isImageContent = (video) => String(video?.content_type || '').toLowerCase() === 'image';

  const handlePreviewMedia = (video) => {
    if (!video) return;
    if (isVideoContent(video)) {
      setActiveVideo(video);
      setShowPlayerModal(true);
      return;
    }
    const mediaUrl = resolvePlayableUrl(video);
    if (mediaUrl) {
      window.open(mediaUrl, '_blank', 'noopener,noreferrer');
    }
  };
  const lessonVideoGroups = useMemo(
    () =>
      lessons.map((lesson) => ({
        ...lesson,
        videos: videos.filter((video) => String(video.lesson_id) === String(lesson.id)),
      })),
    [lessons, videos],
  );
  const unassignedVideos = useMemo(
    () => videos.filter((video) => !video.lesson_id),
    [videos],
  );

  useEffect(() => {
    setOpenLessonSections((prev) => {
      const next = {};
      lessonVideoGroups.forEach((lesson) => {
        next[String(lesson.id)] = prev[String(lesson.id)] ?? false;
      });
      if (unassignedVideos.length > 0) {
        next.unassigned = prev.unassigned ?? false;
      }
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const hasSameKeys = prevKeys.length === nextKeys.length && nextKeys.every((key) => key in prev);
      const hasSameValues = nextKeys.every((key) => prev[key] === next[key]);
      if (hasSameKeys && hasSameValues) return prev;
      return next;
    });
  }, [lessonVideoGroups, unassignedVideos]);

  const toggleLessonSection = (sectionKey) => {
    setOpenLessonSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  return (
    <DashboardSectionPage title="Course Detail">
      <div className="container-fluid px-0" style={{ maxWidth: 1200 }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Link to="/dashboard/course-management" className="btn btn-outline-secondary btn-sm">
            Back to Course Management
          </Link>
          {canManageVideos && (
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-light btn-sm" onClick={openCourseEditModal}>
                Edit Course
              </button>
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleDeleteCourse}>
                Delete Course
              </button>
              <button
                type="button"
                className={`btn btn-sm ${isTrainerUploadAllowed ? 'btn-success' : 'btn-outline-success'}`}
                onClick={handleToggleTrainerUpload}
              >
                {isTrainerUploadAllowed ? 'Trainer Upload Allowed' : 'Allow Upload from Trainer Panel'}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowVideoModal(true)}>
                + Upload Admin Video
              </button>
              <button type="button" className="btn btn-outline-primary" onClick={() => setShowLessonModal(true)}>
                + Add Lesson
              </button>
            </div>
          )}
        </div>

        {(feedback || error) && (
          <div className={`alert ${error ? 'alert-danger' : 'alert-success'} mb-3`}>
            {error || feedback}
          </div>
        )}

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
              <p className="text-uppercase small mb-1 text-light">Course Overview</p>
              <div className="d-flex flex-column flex-md-row align-items-md-center gap-2 mb-1">
                <h1 className="h2 fw-bold mb-0">{course?.title || 'Course Detail'}</h1>
                {canManageVideos && (
                  <button
                    type="button"
                    className="btn btn-light btn-sm align-self-start"
                    onClick={openCourseEditModal}
                  >
                    Edit Title
                  </button>
                )}
              </div>
              <p className="mb-2 text-light">{course?.description || '-'}</p>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <span className="badge bg-light text-dark px-3 py-2">Mode: {course?.delivery_mode || '-'}</span>
                <span className="badge bg-light text-dark px-3 py-2">
                  Catalog type:{' '}
                  {course?.course_type === 'OwningManhattan' ? 'Owning Manhattan' : course?.course_type || '-'}
                </span>
                <span className="badge bg-light text-dark px-3 py-2">
                  Recorded:{' '}
                  {course?.recorded_type === 'Short Courses' ? 'Short Course' : course?.recorded_type || '—'}
                </span>
                <span className="badge bg-light text-dark px-3 py-2">
                  Pricing: {course?.pricing_type || (Number(course?.price) === 0 ? 'Free for Members' : 'Paid')}
                </span>
              </div>
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <div
                    className="rounded-3 p-3 h-100"
                    style={{ background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(3px)' }}
                  >
                    <p className="small text-uppercase mb-1 text-light">Total Videos</p>
                    <h3 className="h4 mb-0 fw-bold">{videos.length}</h3>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div
                    className="rounded-3 p-3 h-100"
                    style={{ background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(3px)' }}
                  >
                    <p className="small text-uppercase mb-1 text-light">Trainer Upload</p>
                    <h3 className="h6 mb-0 fw-bold">{isTrainerUploadAllowed ? 'Enabled' : 'Disabled'}</h3>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div
                    className="rounded-3 p-3 h-100"
                    style={{ background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(3px)' }}
                  >
                    <p className="small text-uppercase mb-1 text-light">Admin Access</p>
                    <h3 className="h6 mb-0 fw-bold">{canManageVideos ? 'Granted' : 'Read Only'}</h3>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="lms-card p-0 mb-3 overflow-hidden border-0" style={{ boxShadow: '0 10px 28px rgba(15,23,42,0.08)' }}>
          <div
            className="d-flex justify-content-between align-items-center p-3 border-bottom"
            style={{ background: 'linear-gradient(180deg,#f8fbff,#ffffff)' }}
          >
            <h2 className="h5 mb-0">Course Videos (Lesson Wise)</h2>
            <span className="badge text-bg-dark px-3 py-2">{videos.length} videos</span>
          </div>
          {videos.length === 0 ? (
            <div className="text-center py-5 text-muted">No videos uploaded yet.</div>
          ) : (
            <div>
              {lessonVideoGroups.map((lesson, index) => (
                <div key={lesson.id} className={index > 0 ? 'border-top' : ''}>
                  <button
                    type="button"
                    className="w-100 border-0 bg-light px-4 py-3 d-flex justify-content-between align-items-center text-start"
                    onClick={() => toggleLessonSection(String(lesson.id))}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted">{openLessonSections[String(lesson.id)] ? '▾' : '▸'}</span>
                      <strong>{lesson.title}</strong>
                    </div>
                    <span className="badge text-bg-secondary">{lesson.videos.length} videos</span>
                  </button>
                  {openLessonSections[String(lesson.id)] && (
                    <div className="p-3">
                      {lesson.videos.length === 0 ? (
                        <div className="text-muted small">No videos in this lesson yet.</div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-hover align-middle mb-0">
                            <thead style={{ background: '#f2f6ff' }}>
                              <tr>
                                <th>Title</th>
                                <th>Short Description</th>
                                <th>Long Description</th>
                                <th>Trainer</th>
                                <th>Status</th>
                                <th>Preview</th>
                                <th>Uploaded On</th>
                                {canManageVideos && <th className="text-end">Actions</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {lesson.videos.map((video) => (
                                <tr key={video.id}>
                                  <td className="fw-semibold">{video.title}</td>
                                  <td>{video.short_description || '-'}</td>
                                  <td>{video.description || '-'}</td>
                                  <td>{video.assigned_trainer_name || '-'}</td>
                                  <td>
                                    <span className={`badge ${Number(video.is_active) === 0 ? 'text-bg-secondary' : 'text-bg-success'}`}>
                                      {Number(video.is_active) === 0 ? 'Inactive' : 'Active'}
                                    </span>
                                  </td>
                                  <td>
                                    {resolvePlayableUrl(video) ? (
                                      isImageContent(video) ? (
                                        <button
                                          type="button"
                                          className="btn p-0 border-0 bg-transparent position-relative"
                                          onClick={() => handlePreviewMedia(video)}
                                          title="Open image"
                                        >
                                          <img
                                            src={resolvePlayableUrl(video)}
                                            alt={video.title || 'Image'}
                                            style={{ width: 160, height: 90, objectFit: 'cover', borderRadius: 8 }}
                                          />
                                        </button>
                                      ) : isVideoContent(video) ? (
                                        <button
                                          type="button"
                                          className="btn p-0 border-0 bg-transparent position-relative"
                                          onClick={() => handlePreviewMedia(video)}
                                          title="Play video"
                                        >
                                          <img
                                            src={resolvePublicMediaUrl(video.thumbnail_url || video.thumbnail_data_url || '', apiBaseUrl) || 'https://via.placeholder.com/200x112?text=Video'}
                                            alt={video.thumbnail_name || `${video.title} thumbnail`}
                                            style={{ width: 160, height: 90, objectFit: 'cover', borderRadius: 8 }}
                                          />
                                        </button>
                                      ) : (
                                        <button type="button" className="btn btn-sm " onClick={() => handlePreviewMedia(video)}>
                                           <i className="bi bi-file-earmark-pdf-fill text-danger fs-5"></i>
                                        </button>
                                      )
                                    ) : (
                                      <span className="small text-muted">Preview unavailable</span>
                                    )}
                                  </td>
                                  <td>{formatDate(video.created_at)}</td>
                                  {canManageVideos && (
                                    <td className="text-end">
                                      <div className="d-flex justify-content-end flex-wrap gap-2">
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-secondary"
                                          onClick={() => navigate(`/dashboard/course-management/${courseId}/videos/${video.id}`)}
                                        >
                                          View
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {unassignedVideos.length > 0 && (
                <div className="border-top">
                  <button
                    type="button"
                    className="w-100 border-0 bg-light px-4 py-3 d-flex justify-content-between align-items-center text-start"
                    onClick={() => toggleLessonSection('unassigned')}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted">{openLessonSections.unassigned ? '▾' : '▸'}</span>
                      <strong>Unassigned Videos</strong>
                    </div>
                    <span className="badge text-bg-secondary">{unassignedVideos.length} videos</span>
                  </button>
                  {openLessonSections.unassigned && (
                    <div className="p-3">
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                          <thead style={{ background: '#f2f6ff' }}>
                            <tr>
                              <th>Title</th>
                              <th>Short Description</th>
                              <th>Long Description</th>
                              <th>Trainer</th>
                              <th>Status</th>
                              <th>Preview</th>
                              <th>Uploaded On</th>
                              {canManageVideos && <th className="text-end">Actions</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {unassignedVideos.map((video) => (
                              <tr key={video.id}>
                                <td className="fw-semibold">{video.title}</td>
                                <td>{video.short_description || '-'}</td>
                                <td>{video.description || '-'}</td>
                                <td>{video.assigned_trainer_name || '-'}</td>
                                <td>
                                  <span className={`badge ${Number(video.is_active) === 0 ? 'text-bg-secondary' : 'text-bg-success'}`}>
                                    {Number(video.is_active) === 0 ? 'Inactive' : 'Active'}
                                  </span>
                                </td>
                                <td>
                                  {resolvePlayableUrl(video) ? (
                                    isImageContent(video) ? (
                                      <button
                                        type="button"
                                        className="btn p-0 border-0 bg-transparent position-relative"
                                        onClick={() => handlePreviewMedia(video)}
                                        title="Open image"
                                      >
                                        <img
                                          src={resolvePlayableUrl(video)}
                                          alt={video.title || 'Image'}
                                          style={{ width: 160, height: 90, objectFit: 'cover', borderRadius: 8 }}
                                        />
                                      </button>
                                    ) : isVideoContent(video) ? (
                                      <button
                                        type="button"
                                        className="btn p-0 border-0 bg-transparent position-relative"
                                        onClick={() => handlePreviewMedia(video)}
                                        title="Play video"
                                      >
                                        <img
                                          src={resolvePublicMediaUrl(video.thumbnail_url || video.thumbnail_data_url || '', apiBaseUrl) || 'https://via.placeholder.com/200x112?text=Video'}
                                          alt={video.thumbnail_name || `${video.title} thumbnail`}
                                          style={{ width: 160, height: 90, objectFit: 'cover', borderRadius: 8 }}
                                        />
                                      </button>
                                    ) : (
                                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => handlePreviewMedia(video)}>
                                        Open File
                                      </button>
                                    )
                                  ) : (
                                    <span className="small text-muted">Preview unavailable</span>
                                  )}
                                </td>
                                <td>{formatDate(video.created_at)}</td>
                                {canManageVideos && (
                                  <td className="text-end">
                                    <div className="d-flex justify-content-end flex-wrap gap-2">
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => navigate(`/dashboard/course-management/${courseId}/videos/${video.id}`)}
                                      >
                                        View
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {showVideoModal && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ background: 'rgba(15,23,42,0.45)', zIndex: 1200 }}>
            <div className="card shadow-lg border-0 overflow-hidden" style={{ width: '100%', maxWidth: 740, borderRadius: 18 }}>
              <div className="card-header border-0 text-white p-4" style={{ background: 'linear-gradient(90deg,#071d3d,#0a5dea)' }}>
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <p className="mb-1 small text-uppercase text-light">Admin Upload</p>
                    <h2 className="h4 mb-1">Upload Course Content</h2>
                    <p className="mb-0 text-light small">Upload video, docs, pdf or image and assign trainer.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-light rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: 32, height: 32 }}
                    onClick={() => setShowVideoModal(false)}
                    aria-label="Close"
                  >
                    x
                  </button>
                </div>
              </div>

              <form onSubmit={handleVideoUpload}>
                <div className="card-body p-4" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
                  <div className="rounded-3 border bg-light p-3 mb-3">
                    <p className="small text-uppercase text-muted mb-2">Publishing Setup</p>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Select Lesson</label>
                      <select
                        className="form-select"
                        value={videoForm.lessonId}
                        onChange={(event) =>
                          setVideoForm((prev) => ({ ...prev, lessonId: event.target.value }))
                        }
                        required
                      >
                        <option value="">Select lesson</option>
                        {lessons.map((lesson) => (
                          <option key={lesson.id} value={lesson.id}>
                            {lesson.title}
                          </option>
                        ))}
                      </select>
                      {lessons.length === 0 && (
                        <small className="text-danger">No lessons found. Add lesson first.</small>
                      )}
                    </div>
                    <div className="mb-0">
                      <label className="form-label fw-semibold">Assign Trainer</label>
                      <select
                        className="form-select"
                        value={videoForm.assignedTrainerId}
                        onChange={(event) =>
                          setVideoForm((prev) => ({ ...prev, assignedTrainerId: event.target.value }))
                        }
                        required
                      >
                        <option value="">Select trainer</option>
                        {trainers.map((trainer) => (
                          <option key={trainer.id} value={trainer.id}>
                            {trainer.name} ({trainer.email})
                          </option>
                        ))}
                      </select>
                      {trainers.length === 0 && (
                        <small className="text-danger">No trainers found. Please create trainer first.</small>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3 border p-3 mb-3">
                    <p className="small text-uppercase text-muted mb-2">Video Content</p>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Video Title</label>
                      <input
                        type="text"
                        value={videoForm.title}
                        onChange={(event) => setVideoForm((prev) => ({ ...prev, title: event.target.value }))}
                        className="form-control"
                        placeholder="Introduction to module"
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Short Description</label>
                      <textarea
                        value={videoForm.shortDescription}
                        onChange={(event) => setVideoForm((prev) => ({ ...prev, shortDescription: event.target.value }))}
                        className="form-control"
                        rows={2}
                        placeholder="Add short description for this content"
                        required
                      />
                    </div>
                    <div className="mb-0">
                      <label className="form-label fw-semibold">Long Description</label>
                      <textarea
                        value={videoForm.description}
                        onChange={(event) => setVideoForm((prev) => ({ ...prev, description: event.target.value }))}
                        className="form-control"
                        rows={4}
                        placeholder="Add detailed long description"
                        required
                      />
                    </div>
                  </div>

                  <div className="rounded-3 border p-3">
                    <p className="small text-uppercase text-muted mb-2">Media Files</p>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Content Type</label>
                      <select
                        className="form-select"
                        value={videoForm.contentType}
                        onChange={(event) =>
                          setVideoForm((prev) => ({
                            ...prev,
                            contentType: event.target.value,
                            thumbnailFile: event.target.value === 'video' ? prev.thumbnailFile : null,
                          }))
                        }
                      >
                        <option value="video">Video</option>
                        <option value="pdf">PDF</option>
                        <option value="doc">Document</option>
                        <option value="image">Image</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Select File</label>
                      <input
                        type="file"
                        accept={
                          videoForm.contentType === 'video'
                            ? 'video/*'
                            : videoForm.contentType === 'pdf'
                              ? 'application/pdf'
                              : videoForm.contentType === 'image'
                                ? 'image/*'
                                : '.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt'
                        }
                        className="form-control"
                        onChange={(event) =>
                          setVideoForm((prev) => ({ ...prev, videoFile: event.target.files?.[0] || null }))
                        }
                        required
                      />
                      <small className="text-muted">Selected file will be uploaded and saved as a URL in DB.</small>
                    </div>
                    {videoForm.contentType === 'video' && (
                      <div className="mb-0">
                      <label className="form-label fw-semibold">Upload Thumbnail</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="form-control"
                        onChange={(event) =>
                          setVideoForm((prev) => ({ ...prev, thumbnailFile: event.target.files?.[0] || null }))
                        }
                        required
                      />
                      <small className="text-muted">Thumbnail will be uploaded and saved as a URL in DB.</small>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-footer bg-white border-0 px-4 pb-4 pt-2">
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" onClick={() => setShowVideoModal(false)} className="btn btn-outline-secondary px-4">Cancel</button>
                    <button type="submit" className="btn btn-primary px-4">Upload Video</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {showEditModal && editingVideo && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ background: 'rgba(15,23,42,0.45)', zIndex: 1300 }}>
            <div className="card shadow-lg border-0 overflow-hidden" style={{ width: '100%', maxWidth: 640, borderRadius: 16 }}>
              <div className="card-header border-0 text-white p-3" style={{ background: 'linear-gradient(90deg,#071d3d,#0a5dea)' }}>
                <div className="d-flex justify-content-between align-items-center">
                  <h3 className="h5 mb-0">Edit Video Details</h3>
                  <button type="button" className="btn btn-sm btn-light" onClick={() => setShowEditModal(false)}>x</button>
                </div>
              </div>
              <form onSubmit={handleEditVideo}>
                <div className="card-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Video Title</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.title}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Short Description</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={editForm.shortDescription}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, shortDescription: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Long Description</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={editForm.description}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label fw-semibold">Select Lesson</label>
                    <select
                      className="form-select mb-3"
                      value={editForm.lessonId}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, lessonId: event.target.value }))}
                      required
                    >
                      <option value="">Select lesson</option>
                      {lessons.map((lesson) => (
                        <option key={lesson.id} value={lesson.id}>
                          {lesson.title}
                        </option>
                      ))}
                    </select>
                    <label className="form-label fw-semibold">Assign Trainer</label>
                    <select
                      className="form-select"
                      value={editForm.assignedTrainerId}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, assignedTrainerId: event.target.value }))}
                      required
                    >
                      <option value="">Select trainer</option>
                      {trainers.map((trainer) => (
                        <option key={trainer.id} value={trainer.id}>
                          {trainer.name} ({trainer.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="card-footer bg-white border-0 px-4 pb-4 pt-2">
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowEditModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">Save Changes</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {showCourseEditModal && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ background: 'rgba(15,23,42,0.45)', zIndex: 1350 }}>
            <div className="card shadow-lg border-0 overflow-hidden" style={{ width: '100%', maxWidth: 700, borderRadius: 16 }}>
              <div className="card-header border-0 text-white p-3" style={{ background: 'linear-gradient(90deg,#071d3d,#0a5dea)' }}>
                <div className="d-flex justify-content-between align-items-center">
                  <h3 className="h5 mb-0">Edit Course</h3>
                  <button type="button" className="btn btn-sm btn-light" onClick={() => setShowCourseEditModal(false)}>x</button>
                </div>
              </div>
              <form onSubmit={handleUpdateCourse}>
                <div className="card-body p-4" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Course Type</label>
                      <select
                        className="form-select"
                        value={courseForm.courseType}
                        onChange={(event) =>
                          setCourseForm((prev) => {
                            const value = event.target.value;
                            if (value === 'Workshop') return { ...prev, courseType: value, deliveryMode: 'Live', recordedType: 'Chapter Wise/Topic Wise' };
                            if (value === 'Short Course') return { ...prev, courseType: value, deliveryMode: 'Recorded', recordedType: 'Short Courses' };
                            if (value === 'OwningManhattan') return { ...prev, courseType: value, deliveryMode: 'Recorded', recordedType: 'Short Courses' };
                            return { ...prev, courseType: value, deliveryMode: 'Recorded', recordedType: 'Chapter Wise/Topic Wise' };
                          })
                        }
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
                        className="form-select"
                        value={courseForm.deliveryMode}
                        onChange={(event) => setCourseForm((prev) => ({ ...prev, deliveryMode: event.target.value }))}
                      >
                        <option value="Live">Live</option>
                        <option value="Recorded">Recorded</option>
                      </select>
                    </div>
                    {courseForm.deliveryMode === 'Recorded' && (
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold">Recorded Type</label>
                        <select
                          className="form-select"
                          value={courseForm.recordedType || 'Chapter Wise/Topic Wise'}
                          onChange={(event) => {
                            setCourseForm((prev) => ({ ...prev, recordedType: event.target.value }));
                          }}
                        >
                          {getRecordedTypeOptions(courseForm.courseType).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Pricing Type</label>
                      <select
                        className="form-select"
                        value={courseForm.pricingType}
                        onChange={(event) => setCourseForm((prev) => ({ ...prev, pricingType: event.target.value }))}
                      >
                        <option value="Paid">Paid</option>
                        <option value="Free for Members">Free for Members</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Title</label>
                    <input
                      className="form-control"
                      value={courseForm.title}
                      onChange={(event) => setCourseForm((prev) => ({ ...prev, title: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Description</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={courseForm.description}
                      onChange={(event) => setCourseForm((prev) => ({ ...prev, description: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label fw-semibold">Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control"
                      value={courseForm.price}
                      disabled={courseForm.pricingType === 'Free for Members'}
                      onChange={(event) => setCourseForm((prev) => ({ ...prev, price: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="card-footer bg-white border-0 px-4 pb-4 pt-2">
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCourseEditModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Save Course
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {showLessonModal && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ background: 'rgba(15,23,42,0.45)', zIndex: 1320 }}>
            <div className="card shadow-lg border-0 overflow-hidden" style={{ width: '100%', maxWidth: 520, borderRadius: 16 }}>
              <div className="card-header border-0 text-white p-3" style={{ background: 'linear-gradient(90deg,#071d3d,#0a5dea)' }}>
                <div className="d-flex justify-content-between align-items-center">
                  <h3 className="h5 mb-0">Add Lesson</h3>
                  <button type="button" className="btn btn-sm btn-light" onClick={() => setShowLessonModal(false)}>x</button>
                </div>
              </div>
              <form onSubmit={handleCreateLesson}>
                <div className="card-body p-4">
                  <label className="form-label fw-semibold">Lesson Title</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Lesson 1: Introduction"
                    value={lessonForm.title}
                    onChange={(event) => setLessonForm({ title: event.target.value })}
                    required
                  />
                </div>
                <div className="card-footer bg-white border-0 px-4 pb-4 pt-2">
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowLessonModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Create Lesson
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {uploadProgress.visible && (
          <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1400, width: '100%', maxWidth: 380 }}>
            <div className="card shadow-lg border-0">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h3 className="h6 mb-0">Uploading: {uploadProgress.title || 'Video'}</h3>
                  <span className="small fw-semibold">{uploadProgress.percent}%</span>
                </div>
                <p className="small text-muted mb-2">{uploadProgress.stage}</p>
                <div className="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={uploadProgress.percent}>
                  <div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: `${uploadProgress.percent}%` }} />
                </div>
                {uploadProgress.error && <p className="small text-danger mt-2 mb-0">{uploadProgress.error}</p>}
              </div>
            </div>
          </div>
        )}

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
    </DashboardSectionPage>
  );
}
