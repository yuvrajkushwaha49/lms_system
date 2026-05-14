import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import StartHereSixSteps from "../student/StartHereSixSteps";
import TrainerDashboardSectionPage from "./TrainerDashboardSectionPage";
import WelcomeFamilyVideoInner from "../student/WelcomeFamilyVideoInner";

export default function TrainerStartHerePage() {
  const navigate = useNavigate();
  const goToCourses = useCallback(() => {
    navigate("/dashboard/trainer-course");
  }, [navigate]);

  return (
    <TrainerDashboardSectionPage title="Start Here">
      <div className="container-fluid px-0 student-panel-page" style={{ maxWidth: 1200 }}>
        <div className="lms-card p-4 p-md-5 mb-3">
          <p className="text-uppercase small text-primary fw-bold mb-2">Welcome</p>
          <h1 className="h3 fw-bold mb-1">Start Here</h1>
          <p className="text-muted mb-0">Watch the welcome message, then jump into your desk.</p>
        </div>

        <WelcomeFamilyVideoInner showHero />

        <StartHereSixSteps variant="trainer" onPickCourse={goToCourses} />

        <div className="lms-card p-4 mt-4 d-flex flex-wrap gap-2 justify-content-end">
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate("/dashboard/trainer-dashboard")}>
            Dashboard
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/dashboard/trainer-course")}>
            Go to courses
          </button>
        </div>
      </div>
    </TrainerDashboardSectionPage>
  );
}
