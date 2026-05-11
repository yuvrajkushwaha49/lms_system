import GenericManagementPage from './GenericManagementPage';

export default function NewsManagementPage() {
  return (
    <GenericManagementPage
      title="News Management"
      hubLabel="Updates Hub"
      description="Publish and maintain important announcements and platform news."
      itemLabel="news item"
      storageKey="news_management_records"
      fields={[
        { key: 'headline', label: 'Headline', placeholder: 'Platform maintenance notice' },
        { key: 'category', label: 'Category', placeholder: 'Product Update' },
        { key: 'summary', label: 'Summary', type: 'textarea', placeholder: 'Short news summary...' },
      ]}
    />
  );
}

