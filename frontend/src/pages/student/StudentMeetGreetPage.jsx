import StudentCommunityFeedPage from "./StudentCommunityFeedPage";

/**
 * Meet + Greet — same member feed as Community, with Meet + Greet hero and title.
 */
export default function StudentMeetGreetPage() {
  return (
    <StudentCommunityFeedPage
      title="Meet + Greet 👋"
      feedVariant="meetGreet"
      feedSpaceFilter="meet-greet"
      storageKey="student_meet_greet_feed_bookmarks"
      postingContext="Meet + Greet"
    />
  );
}
