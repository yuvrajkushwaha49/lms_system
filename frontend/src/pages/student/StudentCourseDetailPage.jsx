import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";
import CommentReportReasonModal from "../../components/CommentReportReasonModal";
import CommunityVideoPlayer from "../../components/CommunityVideoPlayer.jsx";
import CourseAdaptiveVideo from "../../components/CourseAdaptiveVideo.jsx";
import { REPORT_REASONS } from "../../constants/reportReasons";
import { resolvePublicMediaUrl } from "../../utils/mediaUrl";

const toDurationLabel = (seconds) => {
  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0:00";
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const formatCountLabel = (count) => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return `${count}`;
};

const formatPublishedDate = (value) => {
  if (!value) return "recently";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const resolveCommentAuthorName = (comment) =>
  String(
    comment?.user_name || comment?.userName || comment?.name || "Unknown User",
  ).trim() || "Unknown User";

export default function StudentCourseDetailPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const omSearchParams = useMemo(() => new URLSearchParams(search), [search]);
  const fromOwningManhattan = omSearchParams.get("from") === "owning-manhattan";
  const omCinemaMode = fromOwningManhattan && omSearchParams.get("view") === "player";
  const coursesListPath = fromOwningManhattan
    ? "/dashboard/student-owning-manhattan"
    : "/dashboard/student-course";
  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [completedVideoMap, setCompletedVideoMap] = useState({});
  const [videoLikesMap, setVideoLikesMap] = useState({});
  const [videoCommentsMap, setVideoCommentsMap] = useState({});
  const [videoViewsMap, setVideoViewsMap] = useState({});
  const [mediaBookmarkedMap, setMediaBookmarkedMap] = useState({});
  const [mediaBookmarkItems, setMediaBookmarkItems] = useState([]);
  const [videoProgressMetaMap, setVideoProgressMetaMap] = useState({});
  const [lastWatchedVideo, setLastWatchedVideo] = useState(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [courseCommentEditingKey, setCourseCommentEditingKey] = useState(null);
  const [courseCommentEditDraft, setCourseCommentEditDraft] = useState("");
  const [courseCommentBusyId, setCourseCommentBusyId] = useState(null);
  const [courseCommentMenuOpenId, setCourseCommentMenuOpenId] = useState(null);
  const [courseCommentReportTarget, setCourseCommentReportTarget] = useState(null);
  const [courseCommentReportReason, setCourseCommentReportReason] = useState("");
  const [courseCommentNotice, setCourseCommentNotice] = useState("");
  const [courseCommentReplyParentId, setCourseCommentReplyParentId] = useState(null);
  const [courseCommentReplyDraft, setCourseCommentReplyDraft] = useState("");
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [openSections, setOpenSections] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const progressSyncRef = useRef({});
  const resumeSeekRef = useRef(null);
  const omCinemaBootstrappedRef = useRef(false);

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const sessionUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const currentUserIdForComments = Number(sessionUser?.id) || null;
  const canModerateCourseCommentsUi = ["ceo", "admin", "instructor", "trainer"].includes(
    String(sessionUser?.role_name || "").toLowerCase(),
  );

  const refreshCourseVideoEngagement = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || !courseId) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/engagement`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") return;
      const data = payload.data || {};
      if (data.likes && typeof data.likes === "object") setVideoLikesMap(data.likes);
      if (data.comments && typeof data.comments === "object") setVideoCommentsMap(data.comments);
      if (data.progress && typeof data.progress === "object") setCompletedVideoMap(data.progress);
      if (data.views && typeof data.views === "object") setVideoViewsMap(data.views);
      if (data.progressMeta && typeof data.progressMeta === "object") {
        setVideoProgressMetaMap(data.progressMeta);
      }
      setLastWatchedVideo(data.lastWatched || null);
    } catch {
      /* ignore */
    }
  }, [apiBaseUrl, courseId]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      navigate("/login");
      return;
    }

    const fetchCourse = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${apiBaseUrl}/api/courses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Unable to fetch course detail");
        }
        const current = (payload.data || []).find(
          (entry) => String(entry.id) === String(courseId),
        );
        if (!current) throw new Error("Course not found.");
        setCourse(current);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchVideos = async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/courses/${courseId}/videos`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const payload = await response.json();
        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Unable to fetch videos");
        }
        const fetchedVideos = payload.data || [];
        setVideos(fetchedVideos);
      } catch (fetchError) {
        setError(fetchError.message);
      }
    };

    const fetchEngagement = async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/courses/${courseId}/videos/engagement`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const payload = await response.json();
        if (!response.ok || payload.status !== "success") {
          return;
        }
        setVideoLikesMap(
          payload?.data?.likes && typeof payload.data.likes === "object"
            ? payload.data.likes
            : {},
        );
        setVideoCommentsMap(
          payload?.data?.comments && typeof payload.data.comments === "object"
            ? payload.data.comments
            : {},
        );
        setCompletedVideoMap(
          payload?.data?.progress && typeof payload.data.progress === "object"
            ? payload.data.progress
            : {},
        );
        setVideoViewsMap(
          payload?.data?.views && typeof payload.data.views === "object"
            ? payload.data.views
            : {},
        );
        setVideoProgressMetaMap(
          payload?.data?.progressMeta &&
            typeof payload.data.progressMeta === "object"
            ? payload.data.progressMeta
            : {},
        );
        setLastWatchedVideo(payload?.data?.lastWatched || null);
      } catch {
        // keep page usable even if engagement fetch fails
      }
    };

    const fetchMediaBookmarks = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/courses/media-bookmarks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== "success") return;
        const rows = Array.isArray(payload.data) ? payload.data : [];
        const bookmarkMap = {};
        rows.forEach((entry) => {
          bookmarkMap[String(entry.video_id)] = true;
        });
        setMediaBookmarkedMap(bookmarkMap);
        setMediaBookmarkItems(
          rows.map((entry) => ({
            courseId: Number(entry.course_id),
            videoId: Number(entry.video_id),
            title: entry.title || "Untitled media",
            shortDescription: entry.short_description || "",
            description: entry.description || "",
            contentType: entry.content_type || "video",
            openUrl: entry.video_url || "",
            openPath: `/dashboard/student-course/${entry.course_id}`,
          })),
        );
      } catch {
        // ignore media bookmark fetch failure
      }
    };

    fetchCourse();
    fetchVideos();
    fetchEngagement();
    fetchMediaBookmarks();
  }, [apiBaseUrl, courseId, navigate]);

  useEffect(() => {
    omCinemaBootstrappedRef.current = false;
  }, [courseId]);

  useEffect(() => {
    if (!omCinemaMode || isLoading || videos.length === 0 || error) return undefined;
    if (omCinemaBootstrappedRef.current) return undefined;
    const timer = window.setTimeout(() => {
      if (omCinemaBootstrappedRef.current) return;
      const lastVideoId = Number(lastWatchedVideo?.video_id);
      const lastWatchTime = Number(lastWatchedVideo?.watch_time_seconds || 0);
      const hasLastVideo = videos.some((v) => String(v.id) === String(lastVideoId));
      let targetId;
      let seek = 0;
      if (hasLastVideo) {
        targetId = lastVideoId;
        seek = lastWatchTime;
      } else {
        const nextIncomplete = videos.find((v) => !completedVideoMap[String(v.id)]);
        const fallback = nextIncomplete || videos[0];
        targetId = fallback.id;
        seek = Number(videoProgressMetaMap[String(fallback.id)]?.watch_time_seconds || 0);
      }
      const selected = videos.find((v) => String(v.id) === String(targetId));
      if (!selected) {
        omCinemaBootstrappedRef.current = true;
        return;
      }
      const playableUrl =
        selected.video_url || selected.video_data_url || selected.session_video_url || "";
      const isVid = String(selected?.content_type || "video").toLowerCase() === "video";
      if (!isVid) {
        if (playableUrl) {
          window.open(playableUrl, "_blank", "noopener,noreferrer");
        }
        omCinemaBootstrappedRef.current = true;
        navigate(coursesListPath);
        return;
      }
      omCinemaBootstrappedRef.current = true;
      setActiveVideoId(String(targetId));
      setIsPlayerOpen(true);
      resumeSeekRef.current = Math.max(0, seek);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [
    omCinemaMode,
    isLoading,
    videos,
    error,
    lastWatchedVideo,
    videoProgressMetaMap,
    completedVideoMap,
    navigate,
    coursesListPath,
  ]);

  useEffect(() => {
    setCourseCommentMenuOpenId(null);
    setCourseCommentReplyParentId(null);
    setCourseCommentReplyDraft("");
  }, [activeVideoId]);

  useEffect(() => {
    if (courseCommentMenuOpenId === null) return undefined;
    const close = () => setCourseCommentMenuOpenId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [courseCommentMenuOpenId]);

  const markVideoCompleted = (videoId) => {
    if (!videoId) return;
    setCompletedVideoMap((prev) => {
      if (prev[String(videoId)]) return prev;
      return { ...prev, [String(videoId)]: true };
    });
  };

  const saveVideoProgress = async (
    videoId,
    watchTimeSeconds,
    status = "in_progress",
    durationSeconds = 0,
  ) => {
    if (!videoId) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}/progress`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            watch_time_seconds: Math.max(
              0,
              Math.floor(Number(watchTimeSeconds || 0)),
            ),
            status,
            duration_seconds: Math.max(
              0,
              Math.floor(Number(durationSeconds || 0)),
            ),
          }),
        },
      );
    } catch {
      // ignore progress sync failures
    }
  };

  const handleVideoProgress = (event, videoId) => {
    const currentTime = event?.currentTarget?.currentTime || 0;
    const duration = event?.currentTarget?.duration || 0;
    if (!duration) return;
    const roundedCurrent = Math.floor(currentTime);
    const lastSynced = progressSyncRef.current[String(videoId)] || 0;
    if (roundedCurrent - lastSynced >= 10) {
      progressSyncRef.current[String(videoId)] = roundedCurrent;
      saveVideoProgress(videoId, roundedCurrent, "in_progress", duration);
    }
    // Mark complete only when learner has watched almost full duration.
    if (currentTime / duration >= 0.95) {
      markVideoCompleted(videoId);
      saveVideoProgress(videoId, currentTime, "completed", duration);
    }
  };

  const toggleVideoLike = async (videoId) => {
    if (!videoId) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}/likes/toggle`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to update like.");
      }
      setVideoLikesMap((prev) => ({
        ...prev,
        [String(videoId)]: {
          liked: Boolean(payload?.data?.liked),
          count: Number(payload?.data?.like_count || 0),
        },
      }));
    } catch (likeError) {
      setError(likeError.message);
    }
  };

  const addComment = async (videoId, parentCommentId = null) => {
    const trimmed = (parentCommentId ? courseCommentReplyDraft : commentDraft).trim();
    if (!videoId || !trimmed) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            comment_text: trimmed,
            ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to add comment.");
      }
      await refreshCourseVideoEngagement();
      if (parentCommentId) {
        setCourseCommentReplyDraft("");
        setCourseCommentReplyParentId(null);
      } else {
        setCommentDraft("");
      }
    } catch (commentError) {
      setError(commentError.message);
    }
  };

  const reactToComment = async (videoId, commentId, reaction) => {
    if (!videoId || !commentId || !["like", "dislike"].includes(reaction))
      return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}/comments/${commentId}/reaction`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reaction }),
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to react on comment.");
      }
      await refreshCourseVideoEngagement();
    } catch (reactionError) {
      setError(reactionError.message);
    }
  };

  const canModifyCourseVideoCommentItem = (comment) =>
    canModerateCourseCommentsUi ||
    (currentUserIdForComments != null &&
      Number(comment.user_id) === currentUserIdForComments);

  const saveCourseCommentEdit = async (videoId, commentId) => {
    const trimmed = courseCommentEditDraft.trim();
    if (!courseId || !videoId || !commentId || !trimmed) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setCourseCommentBusyId(String(commentId));
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
        throw new Error(payload.message || "Unable to save comment.");
      }
      await refreshCourseVideoEngagement();
      setCourseCommentEditingKey(null);
      setCourseCommentEditDraft("");
      setCourseCommentMenuOpenId(null);
    } catch (editErr) {
      setError(editErr.message);
    } finally {
      setCourseCommentBusyId(null);
    }
  };

  const deleteCourseCommentRequest = async (videoId, commentId) => {
    if (!courseId || !videoId || !commentId) return;
    if (!window.confirm("Delete this comment permanently?")) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setCourseCommentBusyId(String(commentId));
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
        throw new Error(payload.message || "Unable to delete comment.");
      }
      await refreshCourseVideoEngagement();
      setCourseCommentEditingKey(null);
      setCourseCommentEditDraft("");
      setCourseCommentMenuOpenId(null);
    } catch (delErr) {
      setError(delErr.message);
    } finally {
      setCourseCommentBusyId(null);
    }
  };

  const renderCourseVideoCommentNode = (comment, videoId, depth = 0) => {
    const editKey = `${videoId}:${comment.id}`;
    const isEditing = courseCommentEditingKey === editKey;
    const busy = courseCommentBusyId === String(comment.id);
    const canModify = canModifyCourseVideoCommentItem(comment);
    const showReplyTarget = depth === 0;
    const replyOpen = showReplyTarget && courseCommentReplyParentId === comment.id;

    return (
      <Fragment key={String(comment.id)}>
        <div
          className="d-flex align-items-start gap-2 mb-3 student-comment-item"
          style={depth > 0 ? { marginLeft: Math.min(depth * 16, 48) } : undefined}
        >
          <div
            className="rounded-circle bg-secondary text-white d-inline-flex align-items-center justify-content-center"
            style={{
              width: 30,
              height: 30,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {resolveCommentAuthorName(comment).charAt(0).toUpperCase()}
          </div>
          <div className="border rounded-3 px-3 py-2 bg-light w-100">
            <p className="mb-1 fw-semibold small">{resolveCommentAuthorName(comment)}</p>
            {isEditing ? (
              <div className="mb-2">
                <textarea
                  className="form-control form-control-sm"
                  rows={2}
                  value={courseCommentEditDraft}
                  onChange={(event) => setCourseCommentEditDraft(event.target.value)}
                />
                <div className="d-flex gap-2 mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={busy}
                    onClick={() => saveCourseCommentEdit(videoId, comment.id)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={busy}
                    onClick={() => {
                      setCourseCommentEditingKey(null);
                      setCourseCommentEditDraft("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mb-1">{comment.text}</p>
            )}
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <p className="mb-0 text-muted small">
                {new Date(comment.createdAt).toLocaleString()}
              </p>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill ${
                    comment.myReaction === "like" ? "btn-dark" : "btn-outline-secondary"
                  }`}
                  onClick={() => reactToComment(videoId, comment.id, "like")}
                >
                  👍 {Number(comment.likesCount || 0)}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill ${
                    comment.myReaction === "dislike" ? "btn-dark" : "btn-outline-secondary"
                  }`}
                  onClick={() => reactToComment(videoId, comment.id, "dislike")}
                >
                  👎 {Number(comment.dislikesCount || 0)}
                </button>
                {!isEditing ? (
                  <div className="comment-actions-menu-wrap ms-auto">
                    <button
                      type="button"
                      className="comment-actions-toggle"
                      aria-label="Comment actions"
                      aria-expanded={courseCommentMenuOpenId === String(comment.id)}
                      aria-haspopup="menu"
                      onClick={(event) => {
                        event.stopPropagation();
                        setCourseCommentMenuOpenId((cur) =>
                          cur === String(comment.id) ? null : String(comment.id),
                        );
                      }}
                    >
                      ⋮
                    </button>
                    {courseCommentMenuOpenId === String(comment.id) ? (
                      <div
                        className="comment-actions-menu"
                        role="menu"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {showReplyTarget ? (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCourseCommentReplyParentId((cur) =>
                                cur === comment.id ? null : comment.id,
                              );
                              setCourseCommentMenuOpenId(null);
                            }}
                          >
                            Reply
                          </button>
                        ) : null}
                        <button
                          type="button"
                          role="menuitem"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCourseCommentReportTarget({
                              videoId,
                              commentId: comment.id,
                            });
                            setCourseCommentReportReason("");
                            setCourseCommentMenuOpenId(null);
                          }}
                        >
                          Report
                        </button>
                        {canModify ? (
                          <>
                            <button
                              type="button"
                              role="menuitem"
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCourseCommentEditingKey(editKey);
                                setCourseCommentEditDraft(comment.text || "");
                                setCourseCommentMenuOpenId(null);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="text-danger"
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCourseCommentMenuOpenId(null);
                                deleteCourseCommentRequest(videoId, comment.id);
                              }}
                            >
                              Delete
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            {replyOpen ? (
              <div className="d-flex flex-column gap-2 mt-3 pt-2 border-top">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Write a reply..."
                  value={courseCommentReplyDraft}
                  onChange={(event) => setCourseCommentReplyDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addComment(videoId, comment.id);
                  }}
                />
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => addComment(videoId, comment.id)}
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setCourseCommentReplyParentId(null);
                      setCourseCommentReplyDraft("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {(comment.replies || []).map((reply) =>
          renderCourseVideoCommentNode(reply, videoId, depth + 1),
        )}
      </Fragment>
    );
  };

  const submitCourseVideoCommentReport = async () => {
    const videoId = courseCommentReportTarget?.videoId;
    const commentId = courseCommentReportTarget?.commentId;
    if (!courseCommentReportReason.trim() || !courseId || !videoId || !commentId) return;
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      return;
    }
    try {
      setError("");
      const response = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}/comments/${commentId}/reports`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: courseCommentReportReason }),
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to submit report.");
      }
      setCourseCommentNotice("Thanks — your report was submitted for review.");
      setCourseCommentReportTarget(null);
      setCourseCommentReportReason("");
    } catch (reportErr) {
      setError(reportErr.message || "Unable to submit report.");
    }
  };

  const toggleMediaBookmark = async (videoId) => {
    if (!videoId) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/courses/${courseId}/videos/${videoId}/bookmark/toggle`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to update media bookmark.");
      }
      const isBookmarked = Boolean(payload?.data?.bookmarked);
      setMediaBookmarkedMap((prev) => {
        const next = { ...prev, [String(videoId)]: isBookmarked };
        if (!isBookmarked) delete next[String(videoId)];
        return next;
      });
      const selected = videos.find((video) => String(video.id) === String(videoId));
      if (selected) {
        setMediaBookmarkItems((prev) => {
          const exists = prev.some((item) => String(item.videoId) === String(videoId));
          if (isBookmarked) {
            if (exists) return prev;
            return [
              {
                courseId: Number(courseId),
                videoId: Number(videoId),
                title: selected.title || "Untitled media",
                shortDescription: selected.short_description || "",
                description: selected.description || "",
                contentType: selected.content_type || "video",
                openUrl: resolvePlayableUrl(selected),
                openPath: `/dashboard/student-course/${courseId}`,
              },
              ...prev,
            ];
          }
          return prev.filter((item) => String(item.videoId) !== String(videoId));
        });
      }
    } catch (bookmarkError) {
      setError(bookmarkError.message);
    }
  };

  const removeMediaBookmark = async (courseIdToRemove, videoId) => {
    const token = localStorage.getItem("token");
    if (!token || !videoId || !courseIdToRemove) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/courses/${courseIdToRemove}/videos/${videoId}/bookmark/toggle`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to remove media bookmark.");
      }
      setMediaBookmarkedMap((prev) => {
        const next = { ...prev };
        delete next[String(videoId)];
        return next;
      });
      setMediaBookmarkItems((prev) =>
        prev.filter(
          (item) =>
            !(
              String(item.videoId) === String(videoId) &&
              String(item.courseId) === String(courseIdToRemove)
            ),
        ),
      );
    } catch (bookmarkError) {
      setError(bookmarkError.message);
    }
  };

  const playNextVideo = (currentVideoId) => {
    const currentIndex = videos.findIndex(
      (video) => String(video.id) === String(currentVideoId),
    );
    if (currentIndex === -1) return;
    const nextVideo = videos[currentIndex + 1];
    if (nextVideo) {
      setActiveVideoId(nextVideo.id);
      setIsPlayerOpen(true);
    }
  };

  const completedLessons = videos.filter(
    (video) => completedVideoMap[String(video.id)],
  ).length;
  const progressPercent =
    videos.length > 0
      ? Math.round((completedLessons / videos.length) * 100)
      : 0;
  const resolvePlayableUrl = (video) =>
    video?.video_url || video?.video_data_url || video?.session_video_url || "";
  const resolveContentType = (lesson) =>
    String(lesson?.content_type || "video").toLowerCase();
  const isVideoContent = (lesson) =>
    String(lesson?.content_type || "video").toLowerCase() === "video";
  const isImageContent = (lesson) => resolveContentType(lesson) === "image";
  const isPdfContent = (lesson) => resolveContentType(lesson) === "pdf";
  const isDocContent = (lesson) => resolveContentType(lesson) === "doc";
  const activeVideo =
    videos.find((video) => String(video.id) === String(activeVideoId)) || null;
  const activeVideoLikes = activeVideo
    ? videoLikesMap[String(activeVideo.id)] || { count: 0, liked: false }
    : { count: 0, liked: false };
  const activeVideoComments = activeVideo
    ? videoCommentsMap[String(activeVideo.id)] || []
    : [];
  const totalDurationSeconds = videos.reduce(
    (sum, video) => sum + Number(video.duration_seconds || 60),
    0,
  );
  const activeVideoViews = activeVideo
    ? Number(videoViewsMap[String(activeVideo.id)] || 0)
    : 0;

  const activeVideoProcessing = useMemo(
    () =>
      activeVideo
        ? (activeVideo.video_variants || []).some(
            (v) => v.status === "pending" || v.status === "processing",
          )
        : false,
    [activeVideo],
  );

  const sectionGroups = useMemo(
    () =>
      Object.values(
        videos.reduce((acc, video) => {
          const key = video.lesson_title || "General";
          if (!acc[key]) {
            acc[key] = { title: key, lessons: [] };
          }
          acc[key].lessons.push(video);
          return acc;
        }, {}),
      ).filter((section) => section.lessons.length > 0),
    [videos],
  );

  const omCinemaSuggestedVideos = useMemo(
    () =>
      videos.filter(
        (v) =>
          String(v.id) !== String(activeVideoId) &&
          String(v?.content_type || "video").toLowerCase() === "video",
      ),
    [videos, activeVideoId],
  );

  const user = JSON.parse(localStorage.getItem("user")) || {};
  const userName = user?.name || "Student";

  useEffect(() => {
    setOpenSections((prev) => {
      const next = {};
      sectionGroups.forEach((section) => {
        next[section.title] = prev[section.title] ?? false;
      });
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const hasSameKeys =
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => key in prev);
      const hasSameValues = nextKeys.every((key) => prev[key] === next[key]);
      if (hasSameKeys && hasSameValues) return prev;
      return next;
    });
  }, [sectionGroups]);

  const toggleSectionOpen = (sectionTitle) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle],
    }));
  };

  const openVideoWithResume = (videoId, seekSeconds = 0) => {
    const selected = videos.find(
      (video) => String(video.id) === String(videoId),
    );
    if (!selected) return;
    const playableUrl = resolvePlayableUrl(selected);
    if (!isVideoContent(selected)) {
      if (playableUrl) {
        window.open(playableUrl, "_blank", "noopener,noreferrer");
        markVideoCompleted(selected.id);
        saveVideoProgress(
          selected.id,
          Number.MAX_SAFE_INTEGER,
          "completed",
          Number(selected?.duration_seconds || 0),
        );
      }
      if (omCinemaMode) {
        navigate(coursesListPath);
      }
      return;
    }
    setActiveVideoId(videoId);
    setIsPlayerOpen(true);
    resumeSeekRef.current = Math.max(0, Number(seekSeconds || 0));
  };

  const handleContinueLearning = () => {
    if (!videos.length) return;
    const lastVideoId = Number(lastWatchedVideo?.video_id);
    const lastWatchTime = Number(lastWatchedVideo?.watch_time_seconds || 0);
    const hasLastVideo = videos.some(
      (video) => String(video.id) === String(lastVideoId),
    );
    if (hasLastVideo) {
      openVideoWithResume(lastVideoId, lastWatchTime);
      return;
    }
    const nextIncomplete = videos.find(
      (video) => !completedVideoMap[String(video.id)],
    );
    const fallbackVideo = nextIncomplete || videos[0];
    const fallbackProgress = Number(
      videoProgressMetaMap[String(fallbackVideo.id)]?.watch_time_seconds || 0,
    );
    openVideoWithResume(fallbackVideo.id, fallbackProgress);
  };

  const allSectionsOpen =
    sectionGroups.length > 0 &&
    sectionGroups.every((section) => Boolean(openSections[section.title]));

  const toggleAllSections = () => {
    setOpenSections((prev) => {
      const next = {};
      sectionGroups.forEach((section) => {
        next[section.title] = !allSectionsOpen;
      });
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const hasSameKeys =
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => key in prev);
      const hasSameValues = nextKeys.every((key) => prev[key] === next[key]);
      if (hasSameKeys && hasSameValues) return prev;
      return next;
    });
  };

  const renderOmCinemaEngagementPanel = () => {
    if (!activeVideo) return null;
    return (
      <div className="px-4 py-3 border-top student-interaction-panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-circle bg-dark text-white d-inline-flex align-items-center justify-content-center fw-semibold"
              style={{ width: 38, height: 38 }}
            >
              {(course?.title || "O").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="mb-0 fw-semibold">{course?.title || "Owning Manhattan"}</p>
              <p className="mb-0 text-muted small">Owning Manhattan</p>
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className={`btn btn-sm rounded-pill ${activeVideoLikes.liked ? "btn-dark" : "btn-outline-secondary"}`}
              onClick={() => toggleVideoLike(activeVideo.id)}
            >
              👍 {activeVideoLikes.count}
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill ${mediaBookmarkedMap[String(activeVideo.id)] ? "btn-dark" : "btn-outline-secondary"}`}
              onClick={() => toggleMediaBookmark(activeVideo.id)}
            >
              {mediaBookmarkedMap[String(activeVideo.id)] ? "★ Saved" : "☆ Save"}
            </button>
            <button type="button" className="btn btn-sm rounded-pill btn-outline-secondary" disabled>
              👎
            </button>
          </div>
          <span className="text-muted small fw-semibold">
            {activeVideoComments.length} Comments
          </span>
        </div>
        <div className="d-flex gap-2 mb-3 student-comment-input-row">
          <input
            type="text"
            className="form-control"
            placeholder="Add a comment..."
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addComment(activeVideo.id);
            }}
          />
          <button type="button" className="btn btn-primary" onClick={() => addComment(activeVideo.id)}>
            Comment
          </button>
        </div>
        <div className="student-comments-list sell-snack-comments-scroll">
          {activeVideoComments.length === 0 ? (
            <p className="text-muted small mb-0">No comments yet.</p>
          ) : (
            activeVideoComments.map((c) => renderCourseVideoCommentNode(c, activeVideo.id, 0))
          )}
        </div>
        {activeVideoProcessing ? (
          <div className="alert alert-info py-2 mb-0 mt-2">
            HD qualities are processing. Original video is available now.
          </div>
        ) : null}
      </div>
    );
  };

  if (omCinemaMode) {
    const snackStyleCardShadow = { boxShadow: "0 10px 28px rgba(15,23,42,0.08)" };
    const snackStyleHeaderBg = { background: "linear-gradient(180deg,#f8fbff,#ffffff)" };
    const renderOmCinemaPlayer = () => {
      if (!activeVideo) return null;
      const playable = resolvePlayableUrl(activeVideo);
      if (!playable) {
        return (
          <div className="text-center py-5 text-muted">Video source unavailable for this lesson.</div>
        );
      }
      const isHls = /\.m3u8(\?|$)/i.test(playable);
      if (isHls) {
        return (
          <CourseAdaptiveVideo
            key={activeVideo.id}
            src={playable}
            controls
            autoPlay
            onTimeUpdate={(event) => handleVideoProgress(event, activeVideo.id)}
            onLoadedMetadata={(event) => {
              const player = event?.currentTarget;
              const duration = Number(event?.currentTarget?.duration || 0);
              const resumeSeconds = Number(resumeSeekRef.current || 0);
              if (resumeSeconds > 0 && duration > 0) {
                player.currentTime = Math.min(resumeSeconds, Math.max(0, duration - 1));
              }
              resumeSeekRef.current = null;
              if (duration > 0) {
                saveVideoProgress(activeVideo.id, player.currentTime || 0, "in_progress", duration);
              }
            }}
            onEnded={() => {
              markVideoCompleted(activeVideo.id);
              saveVideoProgress(
                activeVideo.id,
                Number.MAX_SAFE_INTEGER,
                "completed",
                Number(activeVideo?.duration_seconds || 0),
              );
              if (autoPlayEnabled) playNextVideo(activeVideo.id);
            }}
            style={{ width: "100%", maxHeight: "min(70vh, 720px)" }}
          />
        );
      }
      return (
        <>
          <CommunityVideoPlayer
            key={activeVideo.id}
            src={playable}
            title={activeVideo.title || "Lesson"}
            variants={activeVideo.video_variants || []}
            autoQualityLabel="Original"
            autoPlay
            onVideoTimeUpdate={(event) => handleVideoProgress(event, activeVideo.id)}
            onVideoLoadedMetadata={(event) => {
              const player = event?.currentTarget;
              const duration = Number(event?.currentTarget?.duration || 0);
              const resumeSeconds = Number(resumeSeekRef.current || 0);
              if (resumeSeconds > 0 && duration > 0) {
                player.currentTime = Math.min(resumeSeconds, Math.max(0, duration - 1));
              }
              resumeSeekRef.current = null;
              if (duration > 0) {
                saveVideoProgress(activeVideo.id, player.currentTime || 0, "in_progress", duration);
              }
            }}
            onVideoEnded={() => {
              markVideoCompleted(activeVideo.id);
              saveVideoProgress(
                activeVideo.id,
                Number.MAX_SAFE_INTEGER,
                "completed",
                Number(activeVideo?.duration_seconds || 0),
              );
              if (autoPlayEnabled) playNextVideo(activeVideo.id);
            }}
            className="w-100"
          />
          {activeVideoProcessing ? (
            <span className="student-community-video-processing">Processing HD</span>
          ) : null}
        </>
      );
    };

    return (
      <StudentDashboardSectionPage
        title="Owning Manhattan"
        bookmarkMediaFiles={mediaBookmarkItems}
        onRemoveBookmarkMedia={removeMediaBookmark}
      >
        <div className="container-fluid px-0 sell-snack-detail-page" style={{ maxWidth: 1200 }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Link to={coursesListPath} className="btn btn-outline-secondary btn-sm">
              Back to Owning Manhattan
            </Link>
          </div>

          {isLoading ? (
            <div className="lms-card p-4 mb-3 text-muted border-0" style={snackStyleCardShadow}>
              Loading…
            </div>
          ) : error ? (
            <>
              <div className="alert alert-danger mb-3">{error}</div>
              <Link to={coursesListPath} className="btn btn-outline-secondary btn-sm">
                Back to Owning Manhattan
              </Link>
            </>
          ) : videos.length === 0 ? (
            <>
              <div className="lms-card p-4 mb-3 text-muted border-0" style={snackStyleCardShadow}>
                No video for this entry yet.
              </div>
              <Link to={coursesListPath} className="btn btn-outline-secondary btn-sm">
                Back to Owning Manhattan
              </Link>
            </>
          ) : !isPlayerOpen || !activeVideo ? (
            <div className="lms-card p-4 mb-3 text-muted border-0" style={snackStyleCardShadow}>
              Preparing player…
            </div>
          ) : (
            <div className="row g-3 align-items-start">
              <div className="col-xl-8">
                <div className="lms-card p-0 overflow-hidden border-0" style={snackStyleCardShadow}>
                  <div
                    className="d-flex justify-content-between align-items-center p-3 border-bottom gap-3 flex-wrap"
                    style={snackStyleHeaderBg}
                  >
                    <div className="min-w-0">
                      <h2
                        className="h5 fw-bold mb-0 text-truncate"
                        title={activeVideo.title || course?.title || ""}
                      >
                        {activeVideo.title || course?.title || "Owning Manhattan"}
                      </h2>
                      <p className="mb-0 text-muted small mt-1">Watch Video</p>
                    </div>
                  </div>
                  <div className="position-relative bg-dark">{renderOmCinemaPlayer()}</div>
                  {renderOmCinemaEngagementPanel()}
                </div>
              </div>
              <div className="col-xl-4">
                <div className="lms-card p-4 sell-snack-suggested-sidebar">
                  <h2 className="h6 fw-bold mb-3 text-uppercase text-muted small">Next suggested video</h2>
                  <div className="sell-snack-suggested-scroll">
                    {omCinemaSuggestedVideos.length === 0 ? (
                      <p className="text-muted small mb-0">No other videos in this episode.</p>
                    ) : (
                      <ul className="list-unstyled mb-0 sell-snack-suggested-list">
                        {omCinemaSuggestedVideos.map((item) => {
                          const likeEntry = videoLikesMap[String(item.id)] || { count: 0 };
                          const viewCount = Number(videoViewsMap[String(item.id)] || 0);
                          const thumb = resolvePublicMediaUrl(
                            item.thumbnail_url || item.thumbnail_data_url || "",
                            apiBaseUrl,
                          );
                          return (
                            <li key={String(item.id)} className="mb-3">
                              <button
                                type="button"
                                className="text-decoration-none text-reset d-flex gap-3 sell-snack-suggested-row w-100 text-start border-0 bg-transparent p-0"
                                onClick={() => openVideoWithResume(item.id, 0)}
                              >
                                <div
                                  className="sell-snack-suggested-thumb flex-shrink-0 rounded overflow-hidden bg-secondary"
                                  style={{
                                    width: 112,
                                    height: 63,
                                    background: thumb
                                      ? `url(${thumb}) center/cover no-repeat`
                                      : "linear-gradient(135deg,#4169ff,#f7efe1)",
                                  }}
                                />
                                <div className="min-w-0">
                                  <p className="fw-semibold mb-1 small sell-snack-suggested-title">
                                    {item.title || "Video"}
                                  </p>
                                  <p className="mb-0 small text-muted text-truncate">
                                    {item.short_description || item.description || "—"}
                                  </p>
                                  <p className="mb-0 small text-muted mt-1">
                                    👍 {Number(likeEntry.count || 0)} · 👁 {viewCount}
                                  </p>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <CommentReportReasonModal
          open={Boolean(courseCommentReportTarget)}
          title="Report comment"
          onClose={() => {
            setCourseCommentReportTarget(null);
            setCourseCommentReportReason("");
          }}
          selectedReason={courseCommentReportReason}
          onSelectReason={setCourseCommentReportReason}
          onSubmit={submitCourseVideoCommentReport}
          reasons={REPORT_REASONS}
        />
      </StudentDashboardSectionPage>
    );
  }

  return (
    <StudentDashboardSectionPage
      title="Course Learning"
      bookmarkMediaFiles={mediaBookmarkItems}
      onRemoveBookmarkMedia={removeMediaBookmark}
    >
      <div
        className="container-fluid px-0 student-course-detail-page"
        style={{ maxWidth: 1140 }}
      >
        <div className="border-bottom pb-3 mb-4">
          <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
            <h1 className="h3 mb-0 fw-bold">{course?.title || "Course"}</h1>
            <Link
              to={coursesListPath}
              className="btn btn-outline-secondary btn-sm"
            >
              {fromOwningManhattan ? "Back to Owning Manhattan" : "Back to Courses"}
            </Link>
          </div>
        </div>

        {error && <div className="alert alert-danger mb-3">{error}</div>}
        {courseCommentNotice && (
          <div className="alert alert-success mb-3">{courseCommentNotice}</div>
        )}

        {isLoading ? (
          <div className="lms-card p-5 text-center text-muted">
            Loading course...
          </div>
        ) : (
          <>
            <div className="d-flex justify-content-between align-items-center mb-4 student-course-welcome">
              <h2 className="display-6 fw-bold mb-0">Welcome, {userName}</h2>

              {progressPercent === 100 ? (
                <button
                  type="button"
                  className="btn btn-success rounded-pill px-4 fw-semibold"
                  onClick={handleContinueLearning}
                  disabled
                >
                  Complete Course
                </button>
              ) : progressPercent > 0 ? (
                <button
                  type="button"
                  className="btn btn-primary rounded-pill px-4 fw-semibold"
                  onClick={handleContinueLearning}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline-primary rounded-pill px-4 fw-semibold"
                  onClick={handleContinueLearning}
                >
                  Start Course
                </button>
              )}
            </div>

            <div className="mb-4">
              <h3 className="h4 fw-bold mb-3">Progress</h3>
              <div className="lms-card p-4 student-progress-card">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <p className="mb-0 fs-5">
                    Completed {completedLessons} of {videos.length} lessons
                  </p>
                  <strong className="fs-5">{progressPercent}%</strong>
                </div>
                <div
                  className="progress student-progress-track"
                  style={{ height: 10 }}
                >
                  <div
                    className="progress-bar bg-dark"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-12 col-md-4">
                <div className="lms-card p-3 student-summary-card">
                  <p className="small text-uppercase text-muted mb-1">
                    Sections
                  </p>
                  <p className="h4 mb-0 fw-bold">{sectionGroups.length}</p>
                </div>
              </div>
              <div className="col-12 col-md-4">
                <div className="lms-card p-3 student-summary-card">
                  <p className="small text-uppercase text-muted mb-1">
                    Lessons
                  </p>
                  <p className="h4 mb-0 fw-bold">{videos.length}</p>
                </div>
              </div>
              <div className="col-12 col-md-4">
                <div className="lms-card p-3 student-summary-card">
                  <p className="small text-uppercase text-muted mb-1">
                    Total Duration
                  </p>
                  <p className="h4 mb-0 fw-bold">
                    {toDurationLabel(totalDurationSeconds)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <h3 className="h3 fw-bold mb-1">Lessons</h3>
              <div className="d-flex justify-content-between align-items-center text-muted flex-wrap gap-2">
                <span>
                  {sectionGroups.length} sections • {videos.length} lessons •{" "}
                  {toDurationLabel(totalDurationSeconds)}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                  onClick={toggleAllSections}
                >
                  {allSectionsOpen
                    ? "Collapse all sections"
                    : "Expand all sections"}
                </button>
              </div>
            </div>

            {isPlayerOpen && activeVideo ? (
              <div className="row g-3 align-items-start">
                <div className="col-12 col-xl-8">
                  <div
                    className="lms-card p-0 overflow-hidden border-0 student-video-shell"
                    style={{ boxShadow: "0 10px 28px rgba(15,23,42,0.08)" }}
                  >
                    <div
                      className="d-flex justify-content-between align-items-center p-3 border-bottom gap-3 flex-wrap"
                      style={{ background: "linear-gradient(180deg,#f8fbff,#ffffff)" }}
                    >
                      <div className="min-w-0">
                        <h2 className="h5 fw-bold mb-0 text-truncate" title={activeVideo.title || ""}>
                          {activeVideo.title || "Untitled lesson"}
                        </h2>
                        <p className="mb-0 text-muted small mt-1">
                          Lesson{" "}
                          {videos.findIndex(
                            (video) => String(video.id) === String(activeVideo.id),
                          ) + 1}{" "}
                          of {videos.length} · Watch Video
                        </p>
                        <p className="small text-muted mb-0 mt-1">
                          {formatCountLabel(activeVideoViews)} views · Published{" "}
                          {formatPublishedDate(activeVideo?.created_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm flex-shrink-0"
                        onClick={() => setIsPlayerOpen(false)}
                      >
                        Back to content
                      </button>
                    </div>
                    <div className="bg-black student-video-frame position-relative">
                      {resolvePlayableUrl(activeVideo) ? (
                        (() => {
                          const playable = resolvePlayableUrl(activeVideo);
                          const isHls = /\.m3u8(\?|$)/i.test(playable);
                          if (isHls) {
                            return (
                              <CourseAdaptiveVideo
                                key={activeVideo.id}
                                src={playable}
                                controls
                                autoPlay
                                onTimeUpdate={(event) =>
                                  handleVideoProgress(event, activeVideo.id)
                                }
                                onLoadedMetadata={(event) => {
                                  const player = event?.currentTarget;
                                  const duration = Number(
                                    event?.currentTarget?.duration || 0,
                                  );
                                  const resumeSeconds = Number(
                                    resumeSeekRef.current || 0,
                                  );
                                  if (resumeSeconds > 0 && duration > 0) {
                                    player.currentTime = Math.min(
                                      resumeSeconds,
                                      Math.max(0, duration - 1),
                                    );
                                  }
                                  resumeSeekRef.current = null;
                                  if (duration > 0) {
                                    saveVideoProgress(
                                      activeVideo.id,
                                      player.currentTime || 0,
                                      "in_progress",
                                      duration,
                                    );
                                  }
                                }}
                                onEnded={() => {
                                  markVideoCompleted(activeVideo.id);
                                  saveVideoProgress(
                                    activeVideo.id,
                                    Number.MAX_SAFE_INTEGER,
                                    "completed",
                                    Number(activeVideo?.duration_seconds || 0),
                                  );
                                  if (autoPlayEnabled) playNextVideo(activeVideo.id);
                                }}
                                style={{ width: "100%", maxHeight: "min(70vh, 720px)" }}
                              />
                            );
                          }
                          return (
                            <>
                              <CommunityVideoPlayer
                                key={activeVideo.id}
                                src={playable}
                                title={activeVideo.title || "Lesson"}
                                variants={activeVideo.video_variants || []}
                                autoQualityLabel="Original"
                                autoPlay
                                onVideoTimeUpdate={(event) =>
                                  handleVideoProgress(event, activeVideo.id)
                                }
                                onVideoLoadedMetadata={(event) => {
                                  const player = event?.currentTarget;
                                  const duration = Number(
                                    event?.currentTarget?.duration || 0,
                                  );
                                  const resumeSeconds = Number(
                                    resumeSeekRef.current || 0,
                                  );
                                  if (resumeSeconds > 0 && duration > 0) {
                                    player.currentTime = Math.min(
                                      resumeSeconds,
                                      Math.max(0, duration - 1),
                                    );
                                  }
                                  resumeSeekRef.current = null;
                                  if (duration > 0) {
                                    saveVideoProgress(
                                      activeVideo.id,
                                      player.currentTime || 0,
                                      "in_progress",
                                      duration,
                                    );
                                  }
                                }}
                                onVideoEnded={() => {
                                  markVideoCompleted(activeVideo.id);
                                  saveVideoProgress(
                                    activeVideo.id,
                                    Number.MAX_SAFE_INTEGER,
                                    "completed",
                                    Number(activeVideo?.duration_seconds || 0),
                                  );
                                  if (autoPlayEnabled) playNextVideo(activeVideo.id);
                                }}
                                className="w-100"
                              />
                              {activeVideoProcessing ? (
                                <span className="student-community-video-processing">
                                  Processing HD
                                </span>
                              ) : null}
                            </>
                          );
                        })()
                      ) : (
                        <div className="text-white text-center py-5 px-4">
                          Video source unavailable for this lesson.
                        </div>
                      )}
                    </div>
                    <div className="px-4 py-3 border-top student-interaction-panel">
                      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="rounded-circle bg-dark text-white d-inline-flex align-items-center justify-content-center fw-semibold"
                            style={{ width: 38, height: 38 }}
                          >
                            {(course?.title || "C").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="mb-0 fw-semibold">
                              {course?.title || "Course Channel"}
                            </p>
                            <p className="mb-0 text-muted small">
                              Learning channel
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <button
                            type="button"
                            className={`btn btn-sm rounded-pill ${activeVideoLikes.liked ? "btn-dark" : "btn-outline-secondary"}`}
                            onClick={() => toggleVideoLike(activeVideo.id)}
                          >
                            👍 {activeVideoLikes.count}
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm rounded-pill ${mediaBookmarkedMap[String(activeVideo.id)] ? "btn-dark" : "btn-outline-secondary"}`}
                            onClick={() => toggleMediaBookmark(activeVideo.id)}
                          >
                            {mediaBookmarkedMap[String(activeVideo.id)] ? "★ Saved" : "☆ Save"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm rounded-pill btn-outline-secondary"
                            disabled
                          >
                            👎
                          </button>
                        </div>
                        <span className="text-muted small fw-semibold">
                          {activeVideoComments.length} Comments
                        </span>
                      </div>
                      <div className="d-flex gap-2 mb-3 student-comment-input-row">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Add a comment..."
                          value={commentDraft}
                          onChange={(event) =>
                            setCommentDraft(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter")
                              addComment(activeVideo.id);
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => addComment(activeVideo.id)}
                        >
                          Comment
                        </button>
                      </div>
                      <div className="student-comments-list">
                        {activeVideoComments.length === 0 ? (
                          <p className="text-muted small mb-0">
                            No comments yet.
                          </p>
                        ) : (
                          activeVideoComments.map((c) =>
                            renderCourseVideoCommentNode(c, activeVideo.id, 0),
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-xl-4">
                  <div className="lms-card p-0 overflow-hidden student-upnext-panel">
                    <div className="d-flex justify-content-between align-items-center px-3 py-3 border-bottom">
                      <div>
                        <h5 className="mb-0 fw-bold">Up next</h5>
                        <span className="text-muted small">
                          {videos.length} videos
                        </span>
                      </div>
                      <div className="form-check form-switch mb-0">
                        <input
                          id="autoplay-switch"
                          className="form-check-input"
                          type="checkbox"
                          checked={autoPlayEnabled}
                          onChange={(event) =>
                            setAutoPlayEnabled(event.target.checked)
                          }
                        />
                        <label
                          className="form-check-label small text-muted"
                          htmlFor="autoplay-switch"
                        >
                          Autoplay
                        </label>
                      </div>
                    </div>
                    {sectionGroups.map((section, sectionIndex) => (
                      <div
                        key={section.title}
                        className={sectionIndex > 0 ? "border-top" : ""}
                      >
                        <button
                          type="button"
                          className="w-100 d-flex justify-content-between align-items-center px-3 py-2 bg-light border-0 text-start"
                          onClick={() => toggleSectionOpen(section.title)}
                        >
                          <div className="d-flex align-items-center gap-2">
                            <span
                              className="text-muted small"
                              style={{ width: 16 }}
                            >
                              {openSections[section.title] ? "▾" : "▸"}
                            </span>
                            <h6 className="mb-0 fw-semibold">
                              {section.title}
                            </h6>
                          </div>
                          <span className="text-muted small">
                            {section.lessons.length} lesson
                            {section.lessons.length > 1 ? "s" : ""}
                          </span>
                        </button>
                        {openSections[section.title] &&
                          section.lessons.map((lesson, lessonIndex) => {
                            const isActive =
                              String(activeVideo?.id) === String(lesson.id);
                            const isCompleted = Boolean(
                              completedVideoMap[String(lesson.id)],
                            );
                            return (
                              <button
                                key={
                                  lesson.id || `${sectionIndex}-${lessonIndex}`
                                }
                                type="button"
                                className={`w-100 text-start border-0 bg-white px-3 py-3 student-upnext-item ${lessonIndex > 0 ? "border-top" : ""}`}
                                onClick={() => {
                                  openVideoWithResume(lesson.id, 0);
                                }}
                                style={
                                  isActive
                                    ? { background: "#eef4ff" }
                                    : undefined
                                }
                              >
                                <div className="d-flex justify-content-between align-items-center gap-2">
                                  <div className="d-flex align-items-center gap-2">
                                    <div
                                      className="rounded-2 bg-dark d-flex align-items-center justify-content-center overflow-hidden"
                                      style={{ width: 54, height: 32 }}
                                    >
                                      {isVideoContent(lesson) ? (
                                        lesson.thumbnail_url ||
                                        lesson.thumbnail_data_url ? (
                                          <img
                                            src={resolvePublicMediaUrl(
                                              lesson.thumbnail_url ||
                                                lesson.thumbnail_data_url ||
                                                "",
                                              apiBaseUrl,
                                            )}
                                            alt={
                                              lesson.title || "Video thumbnail"
                                            }
                                            style={{
                                              width: "100%",
                                              height: "100%",
                                              objectFit: "cover",
                                            }}
                                          />
                                        ) : (
                                          <i className="bi bi-play-circle-fill text-white fs-5"></i>
                                        )
                                      ) : isImageContent(lesson) ? (
                                        <i className="bi bi-image-fill text-white fs-5"></i>
                                      ) : isPdfContent(lesson) ? (
                                        <i className="bi bi-file-earmark-pdf-fill text-danger fs-5"></i>
                                      ) : isDocContent(lesson) ? (
                                        <i className="bi bi-file-earmark-word-fill text-primary fs-5"></i>
                                      ) : (
                                        <i className="bi bi-file-earmark-fill text-secondary fs-5"></i>
                                      )}
                                    </div>
                                    <span
                                      className="rounded-circle d-inline-flex align-items-center justify-content-center"
                                      style={{
                                        width: 20,
                                        height: 20,
                                        background: isActive
                                          ? "#2563eb"
                                          : isCompleted
                                            ? "#16a34a"
                                            : "#9ca3af",
                                        color: "#fff",
                                        fontSize: 12,
                                      }}
                                    >
                                      {isActive ? "▶" : isCompleted ? "✓" : "○"}
                                    </span>
                                    <span
                                      className={isActive ? "fw-semibold" : ""}
                                      style={{ maxWidth: 180 }}
                                    >
                                      {lesson.title ||
                                        `Lesson ${lessonIndex + 1}`}
                                    </span>
                                  </div>
                                  <span className="text-muted small">
                                    {toDurationLabel(
                                      lesson.duration_seconds || 60,
                                    )}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="lms-card p-0 overflow-hidden">
                {sectionGroups.length === 0 ? (
                  <div className="p-4 text-muted">
                    No lessons available for this course yet.
                  </div>
                ) : (
                  sectionGroups.map((section, sectionIndex) => (
                    <div
                      key={section.title}
                      className={sectionIndex > 0 ? "border-top" : ""}
                    >
                      <button
                        type="button"
                        className="w-100 d-flex justify-content-between align-items-center px-4 py-3 bg-light border-0 text-start"
                        onClick={() => toggleSectionOpen(section.title)}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="text-muted small"
                            style={{ width: 16 }}
                          >
                            {openSections[section.title] ? "▾" : "▸"}
                          </span>
                          <h4 className="h4 mb-0 fw-bold">{section.title}</h4>
                        </div>
                        <span className="text-muted">
                          {section.lessons.length} lesson
                          {section.lessons.length > 1 ? "s" : ""} •{" "}
                          {toDurationLabel(
                            section.lessons.reduce(
                              (sum, lesson) =>
                                sum + Number(lesson.duration_seconds || 60),
                              0,
                            ),
                          )}
                        </span>
                      </button>
                      {openSections[section.title] &&
                        section.lessons.map((lesson, lessonIndex) =>
                          (() => {
                            const isCompleted = Boolean(
                              completedVideoMap[String(lesson.id)],
                            );
                            return (
                              <button
                                key={
                                  lesson.id || `${sectionIndex}-${lessonIndex}`
                                }
                                type="button"
                                className={`w-100 text-start border-0 bg-white d-flex justify-content-between align-items-center px-4 py-3 ${lessonIndex > 0 ? "border-top" : ""}`}
                                onClick={() => {
                                  openVideoWithResume(lesson.id, 0);
                                }}
                              >
                                <div className="d-flex align-items-center gap-3">
                                  <span
                                    className="rounded-circle d-inline-flex align-items-center justify-content-center"
                                    style={{
                                      width: 20,
                                      height: 20,
                                      background: isCompleted
                                        ? "#16a34a"
                                        : "#9ca3af",
                                      color: "#fff",
                                      fontSize: 12,
                                    }}
                                  >
                                    {isCompleted ? "✓" : "○"}
                                  </span>
                                  <span className="fs-5">
                                    {lesson.title ||
                                      `Lesson ${lessonIndex + 1}`}
                                  </span>
                                </div>
                                <span className="text-muted">
                                  {toDurationLabel(
                                    lesson.duration_seconds || 60,
                                  )}
                                </span>
                              </button>
                            );
                          })(),
                        )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
      <CommentReportReasonModal
        open={Boolean(courseCommentReportTarget)}
        title="Report comment"
        onClose={() => {
          setCourseCommentReportTarget(null);
          setCourseCommentReportReason("");
        }}
        selectedReason={courseCommentReportReason}
        onSelectReason={setCourseCommentReportReason}
        onSubmit={submitCourseVideoCommentReport}
        reasons={REPORT_REASONS}
      />
    </StudentDashboardSectionPage>
  );
}

