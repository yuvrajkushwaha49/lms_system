import StudentCommunityFeedPage from "../student/StudentCommunityFeedPage";
import TrainerDashboardSectionPage from "./TrainerDashboardSectionPage";

export default function TrainerCommunityFeedPage() {
  return (
    <StudentCommunityFeedPage
      SectionComponent={TrainerDashboardSectionPage}
      title="Feed"
      storageKey="trainer_community_feed_bookmarks"
      roleBadge="Trainer"
      postingContext="Trainer Community"
      showMyFeedFilter={false}
    />
  );
}

