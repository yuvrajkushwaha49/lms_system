import DashboardSectionPage from "./DashboardSectionPage";
import DocumentCenterItemDetailPage from "../../components/DocumentCenterItemDetailPage";

export default function DocumentCenterItemDetailPageRoute() {
  return (
    <DashboardSectionPage title="Documents & Templates">
      <div className="container-fluid px-0 doc-center-shell">
        <DocumentCenterItemDetailPage variant="admin" />
      </div>
    </DashboardSectionPage>
  );
}
