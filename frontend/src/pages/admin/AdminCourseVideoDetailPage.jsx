import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import DashboardSectionPage from "./DashboardSectionPage";
import CommunityVideoPlayer from "../../components/CommunityVideoPlayer.jsx";
import CourseAdaptiveVideo from "../../components/CourseAdaptiveVideo.jsx";

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

const resolveCommentAuthorName = (comment) =>
  String(
    comment?.user_name || comment?.userName || comment?.name || "Unknown User",
  ).trim() || "Unknown User";

const flattenCourseVideoCommentTree = (roots) => {
  if (!Array.isArray(roots)) return [];
  const out = [];
  const walk = (node, depth) => {
    if (!node || node.id == null) return;
    const replies = Array.isArray(node.replies) ? node.replies : [];
    out.push({ ...node, _replyDepth: depth });
    replies.forEach((child) => walk(child, depth + 1));
  };
  roots.forEach((n) => walk(n, 0));
  return out;
};

export default function AdminCourseVideoDetailPage() {
  const { courseId, videoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const courseVideosListPath =
    location.state?.omAdminReturnPath || `/dashboard/course-management/${courseId}`;
  const [course, setCourse] = useState(null);
  const [video, setVideo] = useState(null);
  const [trainers, setTrainers] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    assignedTrainerId: "",
    lessonId: "",
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState("");
  const [likesMap, setLikesMap] = useState({});
  const [commentsMap, setCommentsMap] = useState({});
  const [progressMap, setProgressMap] = useState({});
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [visibleCommentsCount, setVisibleCommentsCount] = useState(10);
  const [commentActionId, setCommentActionId] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentDraft, setEditCommentDraft] = useState("");

  const apiBaseUrl = useMemo(
    () =>
      (import.meta.env.VITE_API_BASE_URL || "http://localhost:5003").replace(
        /\/$/,
        "",
      ),
    [],
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      navigate("/login");
      return;
    }

    const fetchData = async () => {
      try {
        const [coursesRes, videosRes, usersRes, lessonsRes] = await Promise.all(
          [
            fetch(`${apiBaseUrl}/api/courses`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${apiBaseUrl}/api/courses/${courseId}/videos`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${apiBaseUrl}/api/users`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${apiBaseUrl}/api/courses/${courseId}/lessons`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ],
        );

        const [coursesPayload, videosPayload, usersPayload, lessonsPayload] =
          await Promise.all([
            coursesRes.json(),
            videosRes.json(),
            usersRes.json(),
            lessonsRes.json(),
          ]);

        if (!coursesRes.ok || coursesPayload.status !== "success") {
          throw new Error(coursesPayload.message || "Unable to fetch course");
        }
        if (!videosRes.ok || videosPayload.status !== "success") {
          throw new Error(videosPayload.message || "Unable to fetch videos");
        }

        const currentCourse = (coursesPayload.data || []).find(
          (entry) => String(entry.id) === String(courseId),
        );
        const currentVideo = (videosPayload.data || []).find(
          (entry) => String(entry.id) === String(videoId),
        );
        if (!currentCourse) throw new Error("Course not found.");
        if (!currentVideo) throw new Error("Video not found.");

        setCourse(currentCourse);
        setVideo(currentVideo);
        setEditForm({
          title: currentVideo.title || "",
          description: currentVideo.description || "",
          assignedTrainerId: currentVideo.assigned_trainer_id
            ? String(currentVideo.assigned_trainer_id)
            : "",
          lessonId: currentVideo.lesson_id
            ? String(currentVideo.lesson_id)
            : "",
        });

        if (usersRes.ok && usersPayload.status === "success") {
          const trainerList = (usersPayload.data || []).filter((entry) => {
            const role = String(
              entry.role_name || entry.role || "",
            ).toLowerCase();
            return role === "instructor" || role === "trainer";
          });
          setTrainers(trainerList);
        }

        if (lessonsRes.ok && lessonsPayload.status === "success") {
          setLessons(lessonsPayload.data || []);
        }
      } catch (fetchError) {
        setError(fetchError.message);
      }
    };

    fetchData();
  }, [apiBaseUrl, courseId, videoId, navigate]);

  const loadEngagement = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/engagement`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") return;
      const loadedLikes = payload?.data?.likes;
      const loadedComments = payload?.data?.comments;
      const loadedProgress = payload?.data?.progress;
      setLikesMap(loadedLikes && typeof loadedLikes === "object" ? loadedLikes : {});
      setCommentsMap(
        loadedComments && typeof loadedComments === "object" ? loadedComments : {},
      );
      setProgressMap(
        loadedProgress && typeof loadedProgress === "object" ? loadedProgress : {},
      );
    } catch {
      // ignore engagement load errors
    }
  };

  useEffect(() => {
    loadEngagement();
    window.addEventListener("focus", loadEngagement);
    window.addEventListener("storage", loadEngagement);
    return () => {
      window.removeEventListener("focus", loadEngagement);
      window.removeEventListener("storage", loadEngagement);
    };
  }, [apiBaseUrl, courseId]);

  const likeInfo = likesMap[String(videoId)] || { liked: false, count: 0 };
  const comments = Array.isArray(commentsMap[String(videoId)])
    ? commentsMap[String(videoId)]
    : [];
  const flatComments = useMemo(
    () => flattenCourseVideoCommentTree(comments),
    [comments],
  );
  const paginatedComments = useMemo(
    () => flatComments.slice(0, visibleCommentsCount),
    [flatComments, visibleCommentsCount],
  );
  const hasMoreComments = paginatedComments.length < flatComments.length;
  const isCompleted = Boolean(progressMap[String(videoId)]);

  const resolvePlayableUrl = (entry) =>
    entry?.video_url || entry?.video_data_url || entry?.session_video_url || "";

  const handleSave = async (event) => {
    event.preventDefault();
    setFeedback("");
    setError("");
    if (!video) return;
    if (!editForm.title.trim()) {
      setError("Video title is required.");
      return;
    }
    if (!editForm.assignedTrainerId) {
      setError("Please select trainer.");
      return;
    }
    if (!editForm.lessonId) {
      setError("Please select lesson.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      return;
    }

    const assignedTrainer = trainers.find(
      (entry) => String(entry.id) === String(editForm.assignedTrainerId),
    );
    const selectedLesson = lessons.find(
      (entry) => String(entry.id) === String(editForm.lessonId),
    );

    try {
      setIsSaving(true);
      const response = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: editForm.title.trim(),
            description: editForm.description.trim(),
            assigned_trainer_id: editForm.assignedTrainerId,
            assigned_trainer_name: assignedTrainer?.name || null,
            lesson_id: editForm.lessonId,
            lesson_title: selectedLesson?.title || null,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Failed to save video.");
      }

      setVideo((prev) =>
        prev
          ? {
              ...prev,
              title: editForm.title.trim(),
              description: editForm.description.trim(),
              assigned_trainer_id: editForm.assignedTrainerId,
              assigned_trainer_name:
                assignedTrainer?.name || prev.assigned_trainer_name,
              lesson_id: editForm.lessonId,
              lesson_title: selectedLesson?.title || prev.lesson_title,
            }
          : prev,
      );
      setFeedback("Video updated successfully.");
      setShowEditModal(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    setFeedback("");
    setError("");
    const token = localStorage.getItem("token");
    if (!token || !video) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}/status`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Failed to update status.");
      }
      setVideo((prev) =>
        prev
          ? { ...prev, is_active: Number(payload.data?.is_active) || 0 }
          : prev,
      );
      setFeedback(
        Number(payload.data?.is_active) === 1
          ? "Video activated."
          : "Video deactivated.",
      );
    } catch (toggleError) {
      setError(toggleError.message);
    }
  };

  const handleDelete = async () => {
    if (!video) return;
    setFeedback("");
    setError("");
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Failed to delete video.");
      }
      navigate(courseVideosListPath);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const handleConfirmAction = async () => {
    if (confirmAction === "toggle") {
      await handleToggleStatus();
    }
    if (confirmAction === "delete") {
      await handleDelete();
    }
    setConfirmAction("");
  };

  useEffect(() => {
    setVisibleCommentsCount(10);
  }, [videoId, flatComments.length]);

  const handleCommentsScroll = (event) => {
    const node = event.currentTarget;
    const nearBottom =
      node.scrollTop + node.clientHeight >= node.scrollHeight - 40;
    if (nearBottom && hasMoreComments) {
      setVisibleCommentsCount((prev) =>
        Math.min(prev + 10, flatComments.length),
      );
    }
  };

  const handleToggleCommentBlock = async (comment) => {
    const commentId = comment?.id;
    if (!commentId) return;
    const shouldBlock = !Boolean(comment?.is_blocked);
    const confirmText = shouldBlock
      ? "Block this comment? It will be hidden from students."
      : "Unblock this comment?";
    if (!window.confirm(confirmText)) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setFeedback("");
    setError("");
    setCommentActionId(`block-${commentId}`);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}/comments/${commentId}/block`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Failed to update comment block.");
      }
      setFeedback(shouldBlock ? "Comment blocked." : "Comment unblocked.");
      await loadEngagement();
    } catch (commentError) {
      setError(commentError.message || "Failed to update comment.");
    } finally {
      setCommentActionId("");
    }
  };

  const handleDeleteComment = async (comment) => {
    const commentId = comment?.id;
    if (!commentId) return;
    if (!window.confirm("Delete this comment permanently?")) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setFeedback("");
    setError("");
    setCommentActionId(`delete-${commentId}`);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}/comments/${commentId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Failed to delete comment.");
      }
      setFeedback("Comment deleted.");
      await loadEngagement();
    } catch (commentError) {
      setError(commentError.message || "Failed to delete comment.");
    } finally {
      setCommentActionId("");
    }
  };

  const handleSaveEditedComment = async (comment) => {
    const commentId = comment?.id;
    if (!commentId) return;
    const trimmed = editCommentDraft.trim();
    if (!trimmed) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setFeedback("");
    setError("");
    setCommentActionId(`edit-${commentId}`);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ comment_text: trimmed }),
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Failed to update comment.");
      }
      setFeedback("Comment updated.");
      setEditingCommentId(null);
      setEditCommentDraft("");
      await loadEngagement();
    } catch (commentError) {
      setError(commentError.message || "Failed to update comment.");
    } finally {
      setCommentActionId("");
    }
  };

  return (
    <DashboardSectionPage title="Video Detail">
      <div
        className="container-fluid px-0 admin-video-detail-page"
        style={{ maxWidth: 1140 }}
      >
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <Link
            to={courseVideosListPath}
            className="btn btn-outline-secondary btn-sm"
          >
            Back to Course Videos
          </Link>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => setShowEditModal(true)}
            >
              Edit
            </button>
            <button
              type="button"
              className={`btn btn-sm fw-semibold ${Number(video?.is_active) === 1 ? "btn-warning" : "btn-success"}`}
              onClick={() => setConfirmAction("toggle")}
            >
              {Number(video?.is_active) === 1 ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger fw-semibold"
              onClick={() => setConfirmAction("delete")}
            >
              Delete
            </button>
          </div>
        </div>

        {(feedback || error) && (
          <div
            className={`alert ${error ? "alert-danger" : "alert-success"} mb-3`}
          >
            {error || feedback}
          </div>
        )}

        <div
          className="lms-card p-4 p-md-5 mb-3 text-white admin-video-detail-hero"
          style={{
            background: "linear-gradient(120deg,#071d3d,#0d2f69 45%,#0a5dea)",
          }}
        >
          <p className="small text-uppercase mb-1 text-light">
            Admin Video Control Center
          </p>
          <h1 className="h3 fw-bold mb-1">{video?.title || "Video Detail"}</h1>
          <div className="d-flex flex-wrap gap-2">
            <span className="badge bg-light text-dark">
              Course: {course?.title || "-"}
            </span>
            <span className="badge bg-light text-dark">
              Lesson: {video?.lesson_title || "-"}
            </span>
            <span
              className={`badge ${Number(video?.is_active) === 1 ? "text-bg-success" : "text-bg-secondary"}`}
            >
              {Number(video?.is_active) === 1 ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-xl-8">
            <div className="lms-card p-0 overflow-hidden admin-video-main-card">
              <div className="bg-black admin-video-player-wrap">
                {video && resolvePlayableUrl(video) ? (
                  (() => {
                    const playUrl = resolvePlayableUrl(video);
                    if (/\.m3u8(\?|$)/i.test(playUrl)) {
                      return (
                        <CourseAdaptiveVideo
                          src={playUrl}
                          controls
                          style={{ width: "100%", maxHeight: "70vh" }}
                        />
                      );
                    }
                    return (
                      <CommunityVideoPlayer
                        src={playUrl}
                        title={video.title || "Video"}
                        variants={video.video_variants || []}
                        autoQualityLabel="Original"
                        className="w-100"
                      />
                    );
                  })()
                ) : (
                  <div className="text-white text-center py-5">
                    Video preview unavailable.
                  </div>
                )}
              </div>
              <div className="p-4 border-top">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h2 className="h5 mb-0 fw-bold">Video Details</h2>
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <p className="small text-muted mb-1">Title</p>
                    <p className="mb-0 fw-semibold">{video?.title || "-"}</p>
                  </div>
                  <div className="col-md-6">
                    <p className="small text-muted mb-1">Trainer</p>
                    <p className="mb-0 fw-semibold">
                      {video?.assigned_trainer_name || "-"}
                    </p>
                  </div>
                  <div className="col-md-6">
                    <p className="small text-muted mb-1">Lesson</p>
                    <p className="mb-0 fw-semibold">
                      {video?.lesson_title || "-"}
                    </p>
                  </div>
                  <div className="col-md-6">
                    <p className="small text-muted mb-1">Uploaded On</p>
                    <p className="mb-0 fw-semibold">
                      {formatDateTime(video?.created_at)}
                    </p>
                  </div>
                  <div className="col-12">
                    <p className="small text-muted mb-1">Description</p>
                    <p className="mb-0">{video?.description || "-"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="lms-card p-4 mb-3 admin-analysis-card">
              <h3 className="h6 text-uppercase text-muted mb-3">
                Like & Comment Analysis
              </h3>
              <div className="d-flex justify-content-between align-items-center mb-3 admin-metric-row">
                <span>Total Likes</span>
                <strong className="fs-5">{Number(likeInfo.count || 0)}</strong>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-3 admin-metric-row">
                <span>Total Comments</span>
                <strong className="fs-5">{flatComments.length}</strong>
              </div>
              <div className="d-flex justify-content-between align-items-center admin-metric-row">
                <span>Completion Status</span>
                <strong>{isCompleted ? "Completed" : "Not Completed"}</strong>
              </div>
            </div>

            <div className="lms-card p-4 admin-comments-card">
              <h3 className="h6 fw-bold mb-3">Latest Comments</h3>
              {flatComments.length === 0 ? (
                <p className="text-muted small mb-0">
                  No comments on this video yet.
                </p>
              ) : (
                <div
                  style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}
                  onScroll={handleCommentsScroll}
                >
                  {paginatedComments.map((comment, idx) => (
                    <div
                      key={`${comment.id || comment.createdAt}-${idx}`}
                      className={`admin-comment-item p-3 mb-2 ${idx < paginatedComments.length - 1 ? "" : "mb-0"}`}
                      style={{
                        marginLeft: Math.min(24, Number(comment._replyDepth || 0) * 12),
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                        <p className="mb-0 fw-semibold small">
                          {resolveCommentAuthorName(comment)}
                        </p>
                        {Boolean(comment.is_blocked) && (
                          <span className="badge text-bg-warning">Blocked</span>
                        )}
                      </div>
                      {editingCommentId !== comment.id ? (
                        <p className="mb-2">{comment.text || comment.comment_text}</p>
                      ) : (
                        <div className="mb-3">
                          <textarea
                            className="form-control form-control-sm"
                            rows={3}
                            value={editCommentDraft}
                            onChange={(event) => setEditCommentDraft(event.target.value)}
                          />
                          <div className="d-flex gap-2 mt-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => handleSaveEditedComment(comment)}
                              disabled={Boolean(commentActionId)}
                            >
                              {commentActionId === `edit-${comment.id}`
                                ? "Saving..."
                                : "Save"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              disabled={Boolean(commentActionId)}
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditCommentDraft("");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      <p className="mb-0 text-muted small">
                        {formatDateTime(comment.createdAt)}
                      </p>
                      <div className="d-flex justify-content-end gap-2 mt-2 flex-wrap">
                        {editingCommentId !== comment.id && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setEditCommentDraft(
                                String(comment.text || comment.comment_text || ""),
                              );
                            }}
                            disabled={Boolean(commentActionId)}
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-warning"
                          onClick={() => handleToggleCommentBlock(comment)}
                          disabled={Boolean(commentActionId)}
                        >
                          {commentActionId === `block-${comment.id}`
                            ? "Please wait..."
                            : Boolean(comment.is_blocked)
                              ? "Unblock"
                              : "Block"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteComment(comment)}
                          disabled={Boolean(commentActionId)}
                        >
                          {commentActionId === `delete-${comment.id}`
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                  {hasMoreComments && (
                    <p className="text-center text-muted small mt-2 mb-0">
                      Scroll to load more comments...
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {confirmAction && (
          <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
            style={{ background: "rgba(15,23,42,0.55)", zIndex: 1500 }}
          >
            <div
              className="card border-0 shadow-lg"
              style={{ width: "100%", maxWidth: 460 }}
            >
              <div className="card-body p-4">
                <h3 className="h5 fw-bold mb-2">
                  {confirmAction === "delete"
                    ? "Delete Video?"
                    : Number(video?.is_active) === 1
                      ? "Disable Video?"
                      : "Enable Video?"}
                </h3>
                <p className="text-muted mb-4">
                  {confirmAction === "delete"
                    ? `This will permanently remove "${video?.title || "this video"}".`
                    : Number(video?.is_active) === 1
                      ? "Students and trainers will not see this video until you enable it again."
                      : "This video will become visible for allowed users."}
                </p>
                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setConfirmAction("")}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`btn ${confirmAction === "delete" ? "btn-danger" : "btn-primary"}`}
                    onClick={handleConfirmAction}
                  >
                    {confirmAction === "delete"
                      ? "Yes, Delete"
                      : "Yes, Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showEditModal && (
          <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
            style={{ background: "rgba(15,23,42,0.55)", zIndex: 1550 }}
          >
            <div
              className="card border-0 shadow-lg"
              style={{ width: "100%", maxWidth: 640 }}
            >
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <h3 className="h5 mb-0 fw-bold">Edit Video Details</h3>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Close
                </button>
              </div>
              <form onSubmit={handleSave}>
                <div className="card-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Title</label>
                    <input
                      className="form-control admin-video-input"
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, title: e.target.value }))
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Description
                    </label>
                    <textarea
                      className="form-control admin-video-input"
                      rows={3}
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Lesson</label>
                      <select
                        className="form-select admin-video-input"
                        value={editForm.lessonId}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            lessonId: e.target.value,
                          }))
                        }
                      >
                        <option value="">Select lesson</option>
                        {lessons.map((lesson) => (
                          <option key={lesson.id} value={lesson.id}>
                            {lesson.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Trainer</label>
                      <select
                        className="form-select admin-video-input"
                        value={editForm.assignedTrainerId}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            assignedTrainerId: e.target.value,
                          }))
                        }
                      >
                        <option value="">Select trainer</option>
                        {trainers.map((trainer) => (
                          <option key={trainer.id} value={trainer.id}>
                            {trainer.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="card-footer bg-white d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary px-4 fw-semibold"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardSectionPage>
  );
}

