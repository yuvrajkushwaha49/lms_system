import StudentDashboardSectionPage from "./StudentDashboardSectionPage";
import GalleryFolderDetailPage from "../../components/GalleryFolderDetailPage";

export default function StudentGalleryDetailPage() {
  return (
    <StudentDashboardSectionPage title="Gallery">
      <div className="container-fluid px-0 gallery-shell">
        <GalleryFolderDetailPage variant="student" />
      </div>
    </StudentDashboardSectionPage>
  );
}
