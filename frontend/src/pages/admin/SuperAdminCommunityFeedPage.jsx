import DashboardSectionPage from "./DashboardSectionPage";
import StudentCommunityFeedPage from "../student/StudentCommunityFeedPage";

export default function SuperAdminCommunityFeedPage() {
  return (
    <StudentCommunityFeedPage
      SectionComponent={DashboardSectionPage}
      title="Feed Management"
      storageKey="super_admin_community_feed_bookmarks"
      roleBadge="Admin"
      postingContext="Community Hub"
      showMyFeedFilter={false}
    />
  );
}

