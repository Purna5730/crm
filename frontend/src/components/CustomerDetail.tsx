import React, { useEffect, useState } from 'react';
import api from '../api';

interface Note { id: number; note: string; created_by: string; created_at: string; }
interface Customer {
  id: number; name: string; mobile: string; email: string;
  business_name: string; gst_number: string; customer_type: string;
  address: string; status: string; follow_up_date: string; notes: string;
  created_at: string; follow_up_notes: Note[];
}

interface Props { customerId: number; userRole: string; onBack: () => void; onEdit: () => void; }

const CustomerDetail: React.FC<Props> = ({ customerId, userRole, onBack, onEdit }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [newNote, setNewNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [loading, setLoading] = useState(false);

  const canWrite = userRole === 'admin' || userRole === 'sales';
  const canDelete = userRole === 'admin';

  const fetch = async () => {
    const res = await api.get(`/customers/${customerId}`);
    setCustomer(res.data.data);
  };

  useEffect(() => { fetch(); }, [customerId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault(); setNoteError(''); setLoading(true);
    try {
      await api.post(`/customers/${customerId}/notes`, { note: newNote });
      setNewNote('');
      fetch();
    } catch (err: any) {
      setNoteError(err.response?.data?.message || 'Failed to add note');
    } finally { setLoading(false); }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!window.confirm('Delete this note?')) return;
    await api.delete(`/customers/${customerId}/notes/${noteId}`);
    fetch();
  };

  if (!customer) return <div className="loading">Loading...</div>;

  const typeColors: Record<string, string> = { retail: 'type-retail', wholesale: 'type-wholesale', distributor: 'type-distributor' };

  return (
    <div className="detail-page">
      {/* Header */}
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <div className="detail-title">
          <h2>{customer.name}</h2>
          <span className={`badge badge-${customer.status}`}>{customer.status}</span>
          <span className={`badge ${typeColors[customer.customer_type]}`}>{customer.customer_type}</span>
        </div>
        {canWrite && <button className="btn-primary" onClick={onEdit}>✏️ Edit</button>}
      </div>

      <div className="detail-grid">
        {/* Info Card */}
        <div className="detail-card">
          <h4 className="card-title">Contact Information</h4>
          <div className="info-rows">
            <div className="info-row"><span>📱 Mobile</span><strong>{customer.mobile}</strong></div>
            <div className="info-row"><span>✉️ Email</span><strong>{customer.email}</strong></div>
            <div className="info-row"><span>🏢 Business</span><strong>{customer.business_name}</strong></div>
            {customer.gst_number && <div className="info-row"><span>🧾 GST</span><strong>{customer.gst_number}</strong></div>}
            <div className="info-row"><span>📍 Address</span><strong>{customer.address}</strong></div>
          </div>
        </div>

        {/* Status Card */}
        <div className="detail-card">
          <h4 className="card-title">Status & Follow-up</h4>
          <div className="info-rows">
            <div className="info-row"><span>📊 Status</span><span className={`badge badge-${customer.status}`}>{customer.status}</span></div>
            <div className="info-row"><span>👥 Type</span><span className={`badge ${typeColors[customer.customer_type]}`}>{customer.customer_type}</span></div>
            <div className="info-row">
              <span>📅 Follow-up</span>
              <strong>{customer.follow_up_date ? new Date(customer.follow_up_date).toLocaleDateString() : '—'}</strong>
            </div>
            <div className="info-row"><span>🗓️ Created</span><strong>{new Date(customer.created_at).toLocaleDateString()}</strong></div>
          </div>
          {customer.notes && (
            <div className="notes-box">
              <span className="notes-label">📝 Notes</span>
              <p>{customer.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Follow-up Notes */}
      <div className="detail-card followup-section">
        <h4 className="card-title">Follow-up Notes <span className="count-badge">{customer.follow_up_notes.length}</span></h4>

        {canWrite && (
          <form onSubmit={handleAddNote} className="note-form">
            {noteError && <div className="error-msg">{noteError}</div>}
            <textarea
              placeholder="Add a follow-up note..."
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              rows={3}
              required
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Adding...' : '+ Add Note'}
            </button>
          </form>
        )}

        <div className="notes-list">
          {customer.follow_up_notes.length === 0 && <p className="no-data">No follow-up notes yet.</p>}
          {customer.follow_up_notes.map(n => (
            <div key={n.id} className="note-item">
              <div className="note-meta">
                <span className="note-author">👤 {n.created_by}</span>
                <span className="note-date">{new Date(n.created_at).toLocaleString()}</span>
                {canDelete && (
                  <button className="btn-delete-note" onClick={() => handleDeleteNote(n.id)}>✕</button>
                )}
              </div>
              <p className="note-text">{n.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CustomerDetail;
