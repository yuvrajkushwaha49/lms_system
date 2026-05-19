import StudentCourseDetailPage from "./StudentCourseDetailPage";

export default function StudentStartHereStarterPage() {
  return (
    <StudentCourseDetailPage
      courseIdOverride="1"
      backPathOverride="/dashboard/start-here-starter"
    />
  );
}
