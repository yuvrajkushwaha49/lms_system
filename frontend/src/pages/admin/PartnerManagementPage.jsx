import GenericManagementPage from './GenericManagementPage';

export default function PartnerManagementPage() {
  return (
    <GenericManagementPage
      title="Partner Management"
      hubLabel="Business Hub"
      description="Manage partnerships, contacts, and collaboration status."
      itemLabel="partner"
      storageKey="partner_management_records"
      fields={[
        { key: 'name', label: 'Partner Name', placeholder: 'Acme Learning' },
        { key: 'contact', label: 'Contact Person', placeholder: 'John Doe' },
        { key: 'email', label: 'Email', type: 'email', placeholder: 'john@acme.com' },
      ]}
    />
  );
}

