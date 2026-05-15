import DocumentCenterTemplatesContent from "../../components/DocumentCenterTemplatesContent";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";

export default function StudentDocumentCenterPage() {
  return (
    <StudentDashboardSectionPage title="Documents & Templates">
      <div className="container-fluid px-0 doc-center-shell">
        <DocumentCenterTemplatesContent variant="student" />
      </div>
    </StudentDashboardSectionPage>
  );
}
