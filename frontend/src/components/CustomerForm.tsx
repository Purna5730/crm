import React, { useState, useEffect } from 'react';
import api from '../api';

interface Props {
  customerId?: number | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const emptyForm = {
  name: '', mobile: '', email: '', business_name: '', gst_number: '',
  customer_type: 'retail', address: '', status: 'lead', follow_up_date: '', notes: ''
};

const CustomerForm: React.FC<Props> = ({ customerId, onSuccess, onCancel }) => {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customerId) {
      api.get(`/customers/${customerId}`).then(res => {
        const c = res.data.data;
        setForm({
          name: c.name || '', mobile: c.mobile || '', email: c.email || '',
          business_name: c.business_name || '', gst_number: c.gst_number || '',
          customer_type: c.customer_type || 'retail', address: c.address || '',
          status: c.status || 'lead',
          follow_up_date: c.follow_up_date ? c.follow_up_date.split('T')[0] : '',
          notes: c.notes || ''
        });
      });
    }
  }, [customerId]);

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (customerId) {
        await api.put(`/customers/${customerId}`, form);
      } else {
        await api.post('/customers', form);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h3>{customerId ? 'Edit Customer' : 'Add New Customer'}</h3>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit} className="cform">
          <div className="cform-grid">
            <div className="input-group">
              <label>Customer Name *</label>
              <input placeholder="Full name" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Mobile Number *</label>
              <input placeholder="Mobile number" value={form.mobile} onChange={e => set('mobile', e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Email *</label>
              <input type="email" placeholder="Email address" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Business Name *</label>
              <input placeholder="Business / Company name" value={form.business_name} onChange={e => set('business_name', e.target.value)} required />
            </div>
            <div className="input-group">
              <label>GST Number <span className="optional">(optional)</span></label>
              <input placeholder="GST number" value={form.gst_number} onChange={e => set('gst_number', e.target.value)} />
            </div>
            <div className="input-group">
              <label>Customer Type *</label>
              <select value={form.customer_type} onChange={e => set('customer_type', e.target.value)}>
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
                <option value="distributor">Distributor</option>
              </select>
            </div>
            <div className="input-group">
              <label>Status *</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="lead">Lead</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="input-group">
              <label>Follow-up Date</label>
              <input type="date" value={form.follow_up_date} onChange={e => set('follow_up_date', e.target.value)} />
            </div>
            <div className="input-group full-width">
              <label>Address *</label>
              <textarea placeholder="Full address" value={form.address} onChange={e => set('address', e.target.value)} required rows={2} />
            </div>
            <div className="input-group full-width">
              <label>Notes</label>
              <textarea placeholder="Any additional notes..." value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
            </div>
          </div>
          <div className="cform-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : customerId ? 'Update Customer' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerForm;
