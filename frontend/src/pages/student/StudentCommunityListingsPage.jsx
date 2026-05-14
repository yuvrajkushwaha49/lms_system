import StudentCommunityFeedPage from "./StudentCommunityFeedPage";

export default function StudentCommunityListingsPage() {
  return (
    <StudentCommunityFeedPage
      title="Community Listings"
      feedVariant="default"
      feedSpaceFilter="community-listings"
      storageKey="student_community_listings_feed_bookmarks"
      postingContext="Community Listings"
    />
  );
}
