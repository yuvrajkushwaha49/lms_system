import DashboardSectionPage from "./DashboardSectionPage";
import GalleryFolderDetailPage from "../../components/GalleryFolderDetailPage";

export default function GalleryFolderDetailPageRoute() {
  return (
    <DashboardSectionPage title="Gallery">
      <div className="container-fluid px-0 gallery-shell">
        <GalleryFolderDetailPage variant="admin" />
      </div>
    </DashboardSectionPage>
  );
}
