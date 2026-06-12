import StudentDashboardSectionPage from "./StudentDashboardSectionPage";
import GalleryContent from "../../components/GalleryContent";

export default function StudentGalleryPage() {
  return (
    <StudentDashboardSectionPage title="Gallery">
      <div className="container-fluid px-0 gallery-shell">
        <GalleryContent variant="student" />
      </div>
    </StudentDashboardSectionPage>
  );
}
