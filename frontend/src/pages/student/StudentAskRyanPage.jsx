import StudentDashboardSectionPage from "./StudentDashboardSectionPage";
import AskRyanContent from "./AskRyanContent";

export default function StudentAskRyanPage() {
  return (
    <StudentDashboardSectionPage title="Ask Ryan Anything">
      <div className="container-fluid px-0 ask-ryan-shell">
        <AskRyanContent />
      </div>
    </StudentDashboardSectionPage>
  );
}
