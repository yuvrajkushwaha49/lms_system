import DashboardSectionPage from "./DashboardSectionPage";

export default function SuperAdminFeedByMembersPage() {
  return (
    <DashboardSectionPage title="Feed By Members">
      <div className="container-fluid px-0">
        <div className="lms-card p-4 p-md-5 mb-3">
          <h1 className="h3 fw-bold mb-2">Feed By Members</h1>
          <p className="text-muted mb-0">
            Track member-created posts, conversations, and moderation needs from one place.
          </p>
        </div>

        <div className="lms-card p-4">
          <div className="d-flex flex-column flex-md-row gap-3 justify-content-between align-items-md-center">
            <div>
              <h2 className="h5 fw-semibold mb-1">Member activity</h2>
              <p className="text-muted mb-0">Member-wise feed summaries will appear here.</p>
            </div>
            <span className="badge text-bg-light px-3 py-2">Coming soon</span>
          </div>
        </div>
      </div>
    </DashboardSectionPage>
  );
}

