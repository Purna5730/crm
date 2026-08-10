import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

interface Customer { id: number; name: string; mobile: string; business_name: string; address: string; }
interface Product  { id: number; name: string; sku: string; unit_price: number; current_stock: number; }
interface LineItem { product_id: number; product: Product | null; quantity: number; }

interface Props { onSuccess: () => void; onCancel: () => void; }

const ChallanForm: React.FC<Props> = ({ onSuccess, onCancel }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ product_id: 0, product: null, quantity: 1 }]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  useEffect(() => {
    api.get('/customers').then(r => setCustomers(r.data));
    api.get('/products').then(r => setProducts(r.data));
  }, []);

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.business_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.mobile.includes(customerSearch)
  );

  const selectedCustomer = customers.find(c => c.id === Number(customerId));

  const addItem = () => setItems(prev => [...prev, { product_id: 0, product: null, quantity: 1 }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const updateItem = (i: number, field: 'product_id' | 'quantity', value: any) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      if (field === 'product_id') {
        const prod = products.find(p => p.id === Number(value)) || null;
        return { ...item, product_id: Number(value), product: prod };
      }
      return { ...item, [field]: Number(value) };
    }));
  };

  const totalQty    = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalAmount = items.reduce((s, i) => s + ((i.product?.unit_price || 0) * (i.quantity || 0)), 0);

  const handleSubmit = async (status: 'draft' | 'confirmed') => {
    setError(''); setLoading(true);
    try {
      await api.post('/challans', {
        customer_id: Number(customerId),
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        status, notes
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save challan');
    } finally { setLoading(false); }
  };

  const usedProductIds = items.map(i => i.product_id).filter(Boolean);

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 780 }}>
        <div className="modal-header">
          <h3>📋 New Sales Challan</h3>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <div className="cform" style={{ paddingTop: 16 }}>
          {error && <div className="error-msg">{error}</div>}

          {/* Customer Selection */}
          <div className="challan-section">
            <div className="challan-section-title">1. Select Customer</div>
            <input
              className="challan-search-input"
              placeholder="Search customer by name, business or mobile..."
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
            />
            <div className="customer-select-list">
              {filteredCustomers.map(c => (
                <div
                  key={c.id}
                  className={`customer-select-card ${customerId === String(c.id) ? 'selected' : ''}`}
                  onClick={() => setCustomerId(String(c.id))}
                >
                  <div className="csc-name">{c.name}</div>
                  <div className="csc-meta">{c.business_name} · {c.mobile}</div>
                </div>
              ))}
              {filteredCustomers.length === 0 && <p className="no-data" style={{ padding: 12 }}>No customers found</p>}
            </div>
            {selectedCustomer && (
              <div className="selected-customer-box">
                ✅ <strong>{selectedCustomer.name}</strong> — {selectedCustomer.business_name} · {selectedCustomer.mobile}
              </div>
            )}
          </div>

          {/* Products */}
          <div className="challan-section">
            <div className="challan-section-title">2. Add Products</div>
            <table className="challan-items-table">
              <thead>
                <tr><th>#</th><th>Product</th><th>SKU</th><th>Unit Price</th><th>Stock</th><th>Qty</th><th>Total</th><th></th></tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <select
                        value={item.product_id || ''}
                        onChange={e => updateItem(i, 'product_id', e.target.value)}
                      >
                        <option value="">-- Select --</option>
                        {products.map(p => (
                          <option
                            key={p.id} value={p.id}
                            disabled={usedProductIds.includes(p.id) && item.product_id !== p.id}
                          >
                            {p.name} {p.current_stock === 0 ? '(Out of stock)' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{item.product?.sku ? <span className="sku-badge">{item.product.sku}</span> : '—'}</td>
                    <td>{item.product ? `₹${Number(item.product.unit_price).toFixed(2)}` : '—'}</td>
                    <td>
                      {item.product && (
                        <span className={`stock-qty ${item.product.current_stock <= 0 ? 'stock-low' : 'stock-ok'}`}>
                          {item.product.current_stock}
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        type="number" min="1"
                        max={item.product?.current_stock || 9999}
                        value={item.quantity}
                        onChange={e => updateItem(i, 'quantity', e.target.value)}
                        className="qty-input"
                      />
                      {item.product && item.quantity > item.product.current_stock && (
                        <div className="qty-warn">⚠️ Exceeds stock</div>
                      )}
                    </td>
                    <td><strong>{item.product ? `₹${(Number(item.product.unit_price) * item.quantity).toFixed(2)}` : '—'}</strong></td>
                    <td>
                      {items.length > 1 && (
                        <button className="btn-remove-item" onClick={() => removeItem(i)}>✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}></td>
                  <td><strong>{totalQty}</strong></td>
                  <td><strong>₹{totalAmount.toFixed(2)}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <button className="btn-add-item" onClick={addItem}>+ Add Product</button>
          </div>

          {/* Notes */}
          <div className="challan-section">
            <div className="challan-section-title">3. Notes (optional)</div>
            <textarea
              placeholder="Any delivery instructions or remarks..."
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} className="challan-notes"
            />
          </div>

          {/* Summary */}
          <div className="challan-summary">
            <span>Total Items: <strong>{items.filter(i => i.product_id).length}</strong></span>
            <span>Total Qty: <strong>{totalQty}</strong></span>
            <span>Total Amount: <strong>₹{totalAmount.toFixed(2)}</strong></span>
          </div>

          <div className="cform-actions">
            <button className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button
              className="btn-secondary"
              disabled={loading || !customerId || items.every(i => !i.product_id)}
              onClick={() => handleSubmit('draft')}
            >
              💾 Save as Draft
            </button>
            <button
              className="btn-primary"
              disabled={loading || !customerId || items.every(i => !i.product_id)}
              onClick={() => handleSubmit('confirmed')}
            >
              ✅ Confirm Challan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallanForm;
