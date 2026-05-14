import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StartHereSixSteps from "./StartHereSixSteps";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";
import WelcomeFamilyVideoInner from "./WelcomeFamilyVideoInner";

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

  const goToCourse = useCallback(async () => {
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

      navigate(`/dashboard/student-course/${targetCourse.id}?from=start-here`);
    } catch (loadError) {
      setError(loadError.message || "Unable to load Start Here.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, getCourseProgress, navigate]);

  return (
    <StudentDashboardSectionPage title="Start Here">
      <div className="student-start-here-page container-fluid px-0 student-panel-page">
        <header className="student-start-here-hero">
          <span className="student-start-here-hero-badge">Sell It Starter</span>
          <h1 className="student-start-here-hero-title">Start Here</h1>
          <p className="student-start-here-hero-lede">
            Watch the welcome message, complete the quick checklist below, then jump back into your course where you left off.
          </p>
          <ul className="student-start-here-hero-pills" aria-label="What you will do on this page">
            <li>Welcome video</li>
            <li>Six starter steps</li>
            <li>Continue learning</li>
          </ul>
        </header>

        {error && <div className="alert alert-danger student-start-here-alert mb-3">{error}</div>}

        <div className="student-start-here-welcome-slot">
          <WelcomeFamilyVideoInner showHero={false} />
        </div>

        <StartHereSixSteps variant="student" onPickCourse={goToCourse} />

        <div className="student-start-here-cta">
          <div className="student-start-here-cta-copy">
            <h2 className="student-start-here-cta-title">Ready to learn?</h2>
            <p className="student-start-here-cta-text mb-0">
              {hasCourse
                ? "We will open the next lesson in your path based on what you have already completed."
                : "No course is linked to your account yet. Check back soon or contact your admin."}
            </p>
          </div>
          <button
            type="button"
            className="btn student-start-here-cta-btn"
            onClick={goToCourse}
            disabled={isLoading || !hasCourse}
          >
            {isLoading ? "Opening…" : "Continue to my course"}
          </button>
        </div>
      </div>
    </StudentDashboardSectionPage>
  );
}
