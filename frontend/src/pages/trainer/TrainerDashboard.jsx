import TrainerDashboardSectionPage from './TrainerDashboardSectionPage';

export default function TrainerDashboard() {
  return (
    <TrainerDashboardSectionPage title="Trainer Dashboard">
      <div className="container-fluid px-0" style={{ maxWidth: 1200 }}>
        <div className="lms-card p-4 p-md-5 mb-3 text-white" style={{ background: 'linear-gradient(90deg,#0b1f4f,#1d4ed8)' }}>
          <h1 className="h2 fw-bold mb-1">Trainer Dashboard</h1>
          <p className="mb-0 text-light">Track your enrolled courses, progress, and upcoming classes.</p>
        </div>

        <div className="row g-3">
          <div className="col-md-4">
            <div className="lms-card p-4 h-100">
              <p className="text-muted mb-1">Enrolled Courses</p>
              <h3 className="fw-bold mb-0">6</h3>
            </div>
          </div>
          <div className="col-md-4">
            <div className="lms-card p-4 h-100">
              <p className="text-muted mb-1">Completed</p>
              <h3 className="fw-bold mb-0">2</h3>
            </div>
          </div>
          <div className="col-md-4">
            <div className="lms-card p-4 h-100">
              <p className="text-muted mb-1">Pending Assignments</p>
              <h3 className="fw-bold mb-0">4</h3>
            </div>
          </div>
        </div>
      </div>
    </TrainerDashboardSectionPage>
  );
}
