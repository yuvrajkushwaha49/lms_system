import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import DashboardSectionPage from "./DashboardSectionPage";

const SECTION_COPY = {
  "start-here": {
    title: "Start Here",
    description: "Use Course Management and Workshop Management to set up onboarding content for members.",
    showWelcomeVideoAdmin: true,
  },
  "meet-greet": {
    title: "Meet + Greet",
    description: "Configure member-facing Meet + Greet content from the admin tools when this section is ready.",
    showWelcomeVideoAdmin: false,
  },
  "ask-ryan": {
    title: "Ask Ryan Anything",
    description: "Review member questions and publish video replies. Students see answered threads on their Ask Ryan page.",
    showWelcomeVideoAdmin: false,
    showAskRyanAdmin: true,
  },
};

export default function AdminWelcomeNavPlaceholderPage() {
  const { section } = useParams();

  const meta = useMemo(
    () =>
      SECTION_COPY[section] || {
        title: "Welcome",
        description: "",
        showWelcomeVideoAdmin: false,
        showAskRyanAdmin: false,
      },
    [section],
  );

  if (section === "owning-manhattan") {
    return <Navigate to="/dashboard/course-management?type=owning-manhattan" replace />;
  }

  return (
    <DashboardSectionPage title={meta.title}>
      <div className="container-fluid px-0" style={{ maxWidth: 960 }}>
        <div className="lms-card p-4 p-md-5">
          <p className="text-uppercase small text-primary fw-bold mb-2">Welcome!</p>
          <h1 className="h4 fw-bold mb-2">{meta.title}</h1>
          <p className="text-muted mb-4">{meta.description}</p>
          {meta.showWelcomeVideoAdmin && (
            <div className="border rounded-3 p-3 bg-light">
              <p className="fw-semibold mb-2">Welcome to the Sell It family! 💙</p>
              <p className="text-muted small mb-3">
                Upload the YouTube or MP4 link and optional copy — students and trainers see it on <strong>Start Here</strong>.
              </p>
              <Link to="/dashboard/welcome-video-management" className="btn btn-primary">
                Manage welcome video
              </Link>
            </div>
          )}
          {meta.showAskRyanAdmin && (
            <div className="border rounded-3 p-3 bg-light mt-3">
              <p className="fw-semibold mb-2">Member questions &amp; video replies</p>
              <p className="text-muted small mb-3">
                Answer pending questions with a video. Published replies appear like the student-facing Ask Ryan grid.
              </p>
              <Link to="/dashboard/ask-ryan-management" className="btn btn-primary">
                Open Ask Ryan admin
              </Link>
            </div>
          )}
        </div>
      </div>
    </DashboardSectionPage>
  );
}
