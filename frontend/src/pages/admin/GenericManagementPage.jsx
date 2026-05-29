import { useMemo, useState } from 'react';
import DashboardSectionPage from './DashboardSectionPage';

export default function GenericManagementPage({
  title,
  hubLabel,
  description,
  itemLabel,
  fields,
  storageKey,
}) {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [records, setRecords] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [formData, setFormData] = useState(
    fields.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {}),
  );

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      fields.some((field) => String(record[field.key] || '').toLowerCase().includes(query)),
    );
  }, [records, searchTerm, fields]);

  const persistRecords = (nextRecords) => {
    setRecords(nextRecords);
    localStorage.setItem(storageKey, JSON.stringify(nextRecords));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateRecord = (event) => {
    event.preventDefault();
    setFeedback('');
    setError('');

    const hasEmptyField = fields.some((field) => !String(formData[field.key] || '').trim());
    if (hasEmptyField) {
      setError('Please fill all fields.');
      return;
    }

    const nextRecord = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...Object.fromEntries(
        Object.entries(formData).map(([key, value]) => [key, String(value).trim()]),
      ),
    };

    const nextRecords = [nextRecord, ...records];
    persistRecords(nextRecords);
    setFeedback(`${itemLabel} created successfully.`);
    setShowModal(false);
    setFormData(fields.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {}));
  };

  const formatDate = (input) => {
    if (!input) return '-';
    return new Date(input).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <DashboardSectionPage title={title}>
      <div className="container-fluid px-0"  >
        <div className="lms-card p-4 p-md-5 mb-3 text-white" style={{ background: 'linear-gradient(90deg,#071d3d,#0d2f69 45%,#0a5dea)' }}>
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
            <div>
              <p className="text-uppercase small mb-1 text-light">{hubLabel}</p>
              <h1 className="h2 fw-bold mb-1">{title}</h1>
              <p className="mb-0 text-light">{description}</p>
            </div>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-light text-dark fs-6">{filteredRecords.length} records</span>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setFeedback('');
                  setShowModal(true);
                }}
                className="btn btn-warning fw-bold text-capitalize"
              >
                + Add {itemLabel}
              </button>
            </div>
          </div>
        </div>

        {(feedback || error) && (
          <div className={`alert ${error ? 'alert-danger' : 'alert-success'} mb-3`}>
            {error || feedback}
          </div>
        )}

        <div className="lms-card p-3 p-md-4 mb-3">
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
            <div className="w-100" style={{ maxWidth: 520 }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Search ${itemLabel}s...`}
                className="form-control form-control-lg"
              />
            </div>
            <small className="text-muted">
              Showing <strong>{filteredRecords.length}</strong> of <strong>{records.length}</strong>
            </small>
          </div>
        </div>

        <div className="lms-card p-0 mb-3 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  {fields.map((field, index) => (
                    <th key={field.key} className={index === 0 ? 'ps-4' : ''}>{field.label}</th>
                  ))}
                  <th className="d-none d-md-table-cell">Created on</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={fields.length + 1} className="text-center py-5 text-muted">
                      No {itemLabel}s found.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr key={record.id}>
                      {fields.map((field, index) => (
                        <td key={field.key} className={index === 0 ? 'ps-4 fw-semibold' : ''}>
                          {record[field.key] || '-'}
                        </td>
                      ))}
                      <td className="d-none d-md-table-cell">{formatDate(record.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(15,23,42,0.45)', zIndex: 1200 }}>
            <div className="card shadow-lg border-0" style={{ width: '100%', maxWidth: 620, borderRadius: 18 }}>
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h2 className="h4 mb-1 text-capitalize">Add {itemLabel}</h2>
                    <p className="text-muted mb-0 small text-capitalize">
                      Create a new {itemLabel} record.
                    </p>
                  </div>
                  <button type="button" className="btn btn-sm btn-light" onClick={() => setShowModal(false)}>x</button>
                </div>
                <form onSubmit={handleCreateRecord}>
                  {fields.map((field) => (
                    <div key={field.key} className="mb-3">
                      <label className="form-label">{field.label}</label>
                      {field.type === 'textarea' ? (
                        <textarea
                          name={field.key}
                          value={formData[field.key]}
                          onChange={handleChange}
                          required
                          rows={4}
                          className="form-control"
                          placeholder={field.placeholder}
                        />
                      ) : (
                        <input
                          type={field.type || 'text'}
                          name={field.key}
                          value={formData[field.key]}
                          onChange={handleChange}
                          required
                          className="form-control"
                          placeholder={field.placeholder}
                        />
                      )}
                    </div>
                  ))}
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary text-capitalize">
                      Create {itemLabel}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardSectionPage>
  );
}

