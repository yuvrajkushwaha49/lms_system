import SellItSnacksViewerPage from "../student/SellItSnacksViewerPage";
import TrainerDashboardSectionPage from "./TrainerDashboardSectionPage";

export default function TrainerSellItSnacksPage() {
  return (
    <SellItSnacksViewerPage
      SectionComponent={TrainerDashboardSectionPage}
      detailBasePath="/dashboard/trainer-sell-it-snacks"
    />
  );
}

