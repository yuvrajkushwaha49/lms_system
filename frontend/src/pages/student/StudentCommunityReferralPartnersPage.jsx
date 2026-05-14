import StudentCommunityFeedPage from "./StudentCommunityFeedPage";

export default function StudentCommunityReferralPartnersPage() {
  return (
    <StudentCommunityFeedPage
      title="Referral Partners"
      feedVariant="default"
      feedSpaceFilter="referral-partners"
      storageKey="student_community_referral_feed_bookmarks"
      postingContext="Referral Partners"
    />
  );
}
