import GenericManagementPage from './GenericManagementPage';

export default function FeedManagementPage() {
  return (
    <GenericManagementPage
      title="Feed Management"
      hubLabel="Community Hub"
      description="Manage feed posts, highlights, and communication updates."
      itemLabel="feed post"
      storageKey="feed_management_records"
      fields={[
        { key: 'title', label: 'Title', placeholder: 'Weekly learning update' },
        { key: 'audience', label: 'Audience', placeholder: 'All members' },
        { key: 'content', label: 'Content', type: 'textarea', placeholder: 'Write feed content...' },
      ]}
    />
  );
}

