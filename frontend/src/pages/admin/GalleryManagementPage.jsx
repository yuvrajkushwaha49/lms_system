import DashboardSectionPage from "./DashboardSectionPage";
import GalleryContent from "../../components/GalleryContent";

export default function GalleryManagementPage() {
  return (
    <DashboardSectionPage title="Gallery Management">
      <div className="container-fluid px-0 gallery-shell">
        <GalleryContent variant="admin" />
      </div>
    </DashboardSectionPage>
  );
}
