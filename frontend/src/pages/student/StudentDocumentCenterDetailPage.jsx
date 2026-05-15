import DocumentCenterItemDetailPage from "../../components/DocumentCenterItemDetailPage";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";

export default function StudentDocumentCenterDetailPage() {
  return (
    <StudentDashboardSectionPage title="Documents & Templates">
      <div className="container-fluid px-0 doc-center-shell">
        <DocumentCenterItemDetailPage variant="student" />
      </div>
    </StudentDashboardSectionPage>
  );
}
