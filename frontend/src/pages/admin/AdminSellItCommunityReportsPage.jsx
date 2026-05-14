import SuperAdminFeedReportsPage from "./SuperAdminFeedReportsPage";

/** Sell It Community moderation — same reports UI, scoped to posting_space sell-it-community. */
export default function AdminSellItCommunityReportsPage() {
  return (
    <SuperAdminFeedReportsPage
      pageTitle="Sell It Community — Reports"
      heading="Sell It Community — Reports"
      intro="Post and comment reports for Sell It Community only (posting space: sell-it-community)."
      postingSpaceFilter="sell-it-community"
    />
  );
}
