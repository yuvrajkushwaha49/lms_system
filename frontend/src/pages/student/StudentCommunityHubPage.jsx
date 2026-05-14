import StudentCommunityFeedPage from "./StudentCommunityFeedPage";

/** Sell It Community hub — same feed engine, hub hero + members rail. */
export default function StudentCommunityHubPage() {
  return (
    <StudentCommunityFeedPage
      title="Sell It Community"
      feedVariant="communityHub"
      feedSpaceFilter="sell-it-community"
      storageKey="student_community_sell_it_feed_bookmarks"
      postingContext="Sell It Community"
      showMembersRail
    />
  );
}
