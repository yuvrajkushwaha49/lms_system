import TrainerDashboardSectionPage from "./TrainerDashboardSectionPage";
import AskRyanContent from "../student/AskRyanContent";

export default function TrainerAskRyanPage() {
  return (
    <TrainerDashboardSectionPage title="Ask Ryan Anything">
      <div className="container-fluid px-0 ask-ryan-shell">
        <AskRyanContent />
      </div>
    </TrainerDashboardSectionPage>
  );
}
