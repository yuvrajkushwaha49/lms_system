import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";

export default function StudentStartHerePage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasCourse, setHasCourse] = useState(true);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || "http://localhost:5003").replace(/\/$/, ""),
    [],
  );

  const getCourseProgress = useCallback(async (courseId, token) => {
    const videoResponse = await fetch(`${apiBaseUrl}/api/courses/${courseId}/videos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const videoPayload = await videoResponse.json();
    if (!videoResponse.ok || videoPayload.status !== "success") return 0;

    const courseVideos = Array.isArray(videoPayload.data) ? videoPayload.data : [];
    if (!courseVideos.length) return 0;

    const engagementResponse = await fetch(`${apiBaseUrl}/api/courses/${courseId}/videos/engagement`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const engagementPayload = await engagementResponse.json();
    if (!engagementResponse.ok || engagementPayload.status !== "success") return 0;

    const progressMap = engagementPayload?.data?.progress || {};
    const completedCount = courseVideos.filter((video) => Boolean(progressMap[String(video.id)])).length;
    return Math.round((completedCount / courseVideos.length) * 100);
  }, [apiBaseUrl]);

  const loadFirstCourse = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to fetch courses.");
      }

      const courses = Array.isArray(payload.data) ? payload.data : [];
      if (!courses.length) {
        setHasCourse(false);
        return;
      }

      let targetCourse = courses[0];
      for (const course of courses) {
        if (!course?.id) continue;
        const progress = await getCourseProgress(course.id, token);
        if (progress < 100) {
          targetCourse = course;
          break;
        }
      }

      navigate(`/dashboard/student-course/${targetCourse.id}?from=start-here`, { replace: true });
    } catch (loadError) {
      setError(loadError.message || "Unable to load Start Here.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, getCourseProgress, navigate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadFirstCourse, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadFirstCourse]);

  return (
    <StudentDashboardSectionPage title="Start Here">
      <div className="container-fluid px-0 student-panel-page" style={{ maxWidth: 1200 }}>
        <div className="lms-card p-4 p-md-5 mb-3">
          <p className="text-uppercase small text-primary fw-bold mb-2">Sell It Starter</p>
          <h1 className="h3 fw-bold mb-1">Start Here</h1>
          <p className="text-muted mb-0">Begin with your first course and continue from your current progress.</p>
        </div>

        {error && <div className="alert alert-danger mb-3">{error}</div>}

        <div className="lms-card p-4 text-center text-muted">
          {isLoading ? "Redirecting to course detail..." : hasCourse ? "Redirecting..." : "No course available yet."}
        </div>
      </div>
    </StudentDashboardSectionPage>
  );
}

