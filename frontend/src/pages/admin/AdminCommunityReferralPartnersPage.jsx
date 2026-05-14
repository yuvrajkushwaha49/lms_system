import DashboardSectionPage from "./DashboardSectionPage";
import StudentCommunityFeedPage from "../student/StudentCommunityFeedPage";

export default function AdminCommunityReferralPartnersPage() {
  return (
    <StudentCommunityFeedPage
      SectionComponent={DashboardSectionPage}
      title="Referral Partners"
      storageKey="admin_community_referral_feed_bookmarks"
      roleBadge="Admin"
      postingContext="Referral Partners"
      showMyFeedFilter={false}
      feedVariant="default"
      feedSpaceFilter="referral-partners"
    />
  );
}
