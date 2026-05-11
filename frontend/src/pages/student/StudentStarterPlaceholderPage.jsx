import StudentDashboardSectionPage from "./StudentDashboardSectionPage";

export default function StudentStarterPlaceholderPage({ title, description }) {
  return (
    <StudentDashboardSectionPage title={title}>
      <div className="container-fluid px-0" style={{ maxWidth: 1100 }}>
        <div className="lms-card p-4 p-md-5">
          <p className="text-uppercase small text-primary fw-bold mb-2">Sell It Starter</p>
          <h1 className="h3 fw-bold mb-2">{title}</h1>
          <p className="text-muted mb-0">{description}</p>
        </div>
      </div>
    </StudentDashboardSectionPage>
  );
}

