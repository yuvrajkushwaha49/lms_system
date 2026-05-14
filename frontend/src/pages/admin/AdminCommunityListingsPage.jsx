import DashboardSectionPage from "./DashboardSectionPage";
import StudentCommunityFeedPage from "../student/StudentCommunityFeedPage";

export default function AdminCommunityListingsPage() {
  return (
    <StudentCommunityFeedPage
      SectionComponent={DashboardSectionPage}
      title="Community Listings"
      storageKey="admin_community_listings_feed_bookmarks"
      roleBadge="Admin"
      postingContext="Community Listings"
      showMyFeedFilter={false}
      feedVariant="default"
      feedSpaceFilter="community-listings"
    />
  );
}
