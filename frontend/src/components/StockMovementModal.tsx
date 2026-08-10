import React, { useState } from 'react';
import api from '../api';

interface Props {
  productId: number;
  productName: string;
  currentStock: number;
  onSuccess: () => void;
  onCancel: () => void;
}

const StockMovementModal: React.FC<Props> = ({ productId, productName, currentStock, onSuccess, onCancel }) => {
  const [form, setForm] = useState({ quantity: '', movement_type: 'IN', reason: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await api.post(`/products/${productId}/stock`, form);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update stock');
    } finally { setLoading(false); }
  };

  const previewStock = form.quantity
    ? form.movement_type === 'IN'
      ? currentStock + Number(form.quantity)
      : currentStock - Number(form.quantity)
    : currentStock;

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3>Stock Movement</h3>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="cform">
          <div className="stock-product-info">
            <span className="stock-product-name">📦 {productName}</span>
            <span className="stock-current">Current Stock: <strong>{currentStock}</strong></span>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="movement-type-toggle">
              <button
                type="button"
                className={`toggle-btn ${form.movement_type === 'IN' ? 'toggle-in active' : 'toggle-in'}`}
                onClick={() => setForm(f => ({ ...f, movement_type: 'IN' }))}
              >
                ↑ Stock IN
              </button>
              <button
                type="button"
                className={`toggle-btn ${form.movement_type === 'OUT' ? 'toggle-out active' : 'toggle-out'}`}
                onClick={() => setForm(f => ({ ...f, movement_type: 'OUT' }))}
              >
                ↓ Stock OUT
              </button>
            </div>

            <div className="input-group" style={{ marginTop: 16 }}>
              <label>Quantity *</label>
              <input
                type="number" min="1" placeholder="Enter quantity"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                required
              />
            </div>

            <div className="input-group">
              <label>Reason</label>
              <input
                placeholder="e.g. Purchase order, Sale, Damage..."
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>

            {form.quantity && (
              <div className={`stock-preview ${previewStock < 0 ? 'preview-danger' : ''}`}>
                Stock after movement: <strong>{previewStock}</strong>
                {previewStock < 0 && <span> ⚠️ Insufficient stock!</span>}
              </div>
            )}

            <div className="cform-actions">
              <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
              <button
                type="submit"
                className={`btn-primary ${form.movement_type === 'OUT' ? 'btn-danger' : ''}`}
                disabled={loading || previewStock < 0}
              >
                {loading ? 'Updating...' : `Confirm ${form.movement_type}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StockMovementModal;
