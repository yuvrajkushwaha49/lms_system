import { useLocation } from "react-router-dom";
import StudentCommunityFeedPage from "./StudentCommunityFeedPage";

/** Sell It Community hub — same feed engine, hub hero + members rail. */
export default function StudentCommunityHubPage() {
  const { pathname } = useLocation();
  const isFeedRoute = pathname === "/dashboard/feed";

  return (
    <StudentCommunityFeedPage
      title="Sell It Community"
      feedVariant="communityHub"
      feedSpaceFilter="sell-it-community"
      storageKey="student_community_sell_it_feed_bookmarks"
      postingContext="Sell It Community"
      showMembersRail={!isFeedRoute}
    />
  );
}
