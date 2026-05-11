import GenericManagementPage from './GenericManagementPage';

export default function DocumentCenterManagementPage() {
  return (
    <GenericManagementPage
      title="Document Center Management"
      hubLabel="Resource Hub"
      description="Manage documentation records and access details for teams."
      itemLabel="document"
      storageKey="document_center_management_records"
      fields={[
        { key: 'name', label: 'Document Name', placeholder: 'Onboarding Guide' },
        { key: 'type', label: 'Type', placeholder: 'PDF' },
        { key: 'owner', label: 'Owner', placeholder: 'Operations Team' },
      ]}
    />
  );
}

