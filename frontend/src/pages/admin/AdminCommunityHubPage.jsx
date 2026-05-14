import DashboardSectionPage from "./DashboardSectionPage";
import StudentCommunityFeedPage from "../student/StudentCommunityFeedPage";

export default function AdminCommunityHubPage() {
  return (
    <StudentCommunityFeedPage
      SectionComponent={DashboardSectionPage}
      title="Sell It Community"
      storageKey="admin_community_sell_it_feed_bookmarks"
      roleBadge="Admin"
      postingContext="Sell It Community"
      showMyFeedFilter={false}
      feedVariant="communityHub"
      feedSpaceFilter="sell-it-community"
      showMembersRail
      membersRailCtaPath="/dashboard/members-management"
      membersRailCtaLabel="Members management"
      memberProfileLinkTo="/dashboard/members-management"
      showMemberProfileMessageButton={false}
    />
  );
}
