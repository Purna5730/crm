import React, { useState, useEffect } from 'react';
import api from '../api';

interface Props {
  productId?: number | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const emptyForm = {
  name: '', sku: '', category: '', unit_price: '', current_stock: '0', min_stock_alert: '5', location: ''
};

const ProductForm: React.FC<Props> = ({ productId, onSuccess, onCancel }) => {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isEdit = !!productId;

  useEffect(() => {
    if (productId) {
      api.get(`/products/${productId}`).then(res => {
        const p = res.data.data;
        setForm({
          name: p.name, sku: p.sku, category: p.category,
          unit_price: p.unit_price, current_stock: p.current_stock,
          min_stock_alert: p.min_stock_alert, location: p.location || ''
        });
      });
    }
  }, [productId]);

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/products/${productId}`, form);
      } else {
        await api.post('/products', form);
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
          <h3>{isEdit ? 'Edit Product' : 'Add New Product'}</h3>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        {error && <div className="error-msg" style={{ margin: '12px 24px 0' }}>{error}</div>}
        <form onSubmit={handleSubmit} className="cform">
          <div className="cform-grid">
            <div className="input-group">
              <label>Product Name *</label>
              <input placeholder="e.g. Wireless Mouse" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="input-group">
              <label>SKU / Code *</label>
              <input placeholder="e.g. WM-001" value={form.sku} onChange={e => set('sku', e.target.value)} required disabled={isEdit} />
            </div>
            <div className="input-group">
              <label>Category *</label>
              <input placeholder="e.g. Electronics" value={form.category} onChange={e => set('category', e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Unit Price (₹) *</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} required />
            </div>
            {!isEdit && (
              <div className="input-group">
                <label>Opening Stock *</label>
                <input type="number" min="0" placeholder="0" value={form.current_stock} onChange={e => set('current_stock', e.target.value)} required />
              </div>
            )}
            <div className="input-group">
              <label>Min Stock Alert *</label>
              <input type="number" min="0" placeholder="5" value={form.min_stock_alert} onChange={e => set('min_stock_alert', e.target.value)} required />
            </div>
            <div className={`input-group ${!isEdit ? '' : 'full-width'}`}>
              <label>Location / Warehouse</label>
              <input placeholder="e.g. Warehouse A, Shelf 3" value={form.location} onChange={e => set('location', e.target.value)} />
            </div>
          </div>
          <div className="cform-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductForm;
