import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import ProductForm from './ProductForm';
import StockMovementModal from './StockMovementModal';

interface Product {
  id: number; name: string; sku: string; category: string;
  unit_price: number; current_stock: number; min_stock_alert: number; location: string;
}

interface Movement {
  id: number; product_name: string; sku: string; quantity: number;
  movement_type: string; reason: string; created_by: string; created_at: string;
}

interface Props { userRole: string; }

const canWrite = (role: string) => role === 'admin' || role === 'warehouse';
const canDelete = (role: string) => role === 'admin';

type Tab = 'products' | 'movements';

const Products: React.FC<Props> = ({ userRole }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('products');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [stockModal, setStockModal] = useState<Product | null>(null);
  const [error, setError] = useState('');

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/products', { params: { search } });
      setProducts(res.data.data);
    } catch { setError('Failed to load products'); }
  }, [search]);

  const fetchMovements = useCallback(async () => {
    try {
      const res = await api.get('/products/movements');
      setMovements(res.data.data);
    } catch { setError('Failed to load movements'); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { if (tab === 'movements') fetchMovements(); }, [tab, fetchMovements]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this product and all its stock history?')) return;
    try {
      await api.delete(`/products/${id}`);
      fetchProducts();
    } catch (err: any) { setError(err.response?.data?.message || 'Delete failed'); }
  };

  const handleFormSuccess = () => { setShowForm(false); setEditId(null); fetchProducts(); };
  const handleStockSuccess = () => { setStockModal(null); fetchProducts(); if (tab === 'movements') fetchMovements(); };

  const lowStockCount = products.filter(p => p.current_stock <= p.min_stock_alert).length;

  return (
    <div className="customers-container">
      {showForm && (
        <ProductForm
          productId={editId}
          onSuccess={handleFormSuccess}
          onCancel={() => { setShowForm(false); setEditId(null); }}
        />
      )}
      {stockModal && (
        <StockMovementModal
          productId={stockModal.id}
          productName={stockModal.name}
          currentStock={stockModal.current_stock}
          onSuccess={handleStockSuccess}
          onCancel={() => setStockModal(null)}
        />
      )}

      {/* Header */}
      <div className="customers-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Products <span className="count-badge">{products.length}</span></h2>
          {lowStockCount > 0 && (
            <span className="low-stock-alert">⚠️ {lowStockCount} low stock</span>
          )}
        </div>
        {canWrite(userRole) && tab === 'products' && (
          <button className="btn-primary" onClick={() => { setEditId(null); setShowForm(true); }}>
            + Add Product
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="section-tabs">
        <button className={tab === 'products' ? 'stab-active' : ''} onClick={() => setTab('products')}>
          📦 Products
        </button>
        <button className={tab === 'movements' ? 'stab-active' : ''} onClick={() => { setTab('movements'); fetchMovements(); }}>
          📋 Stock Movement Log
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Products Tab */}
      {tab === 'products' && (
        <>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              placeholder="Search by name, SKU, category or location..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
          <div className="table-wrapper">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>#</th><th>Product Name</th><th>SKU</th><th>Category</th>
                  <th>Unit Price</th><th>Stock</th><th>Min Alert</th><th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={p.id} className={p.current_stock <= p.min_stock_alert ? 'low-stock-row' : ''}>
                    <td>{i + 1}</td>
                    <td><strong>{p.name}</strong></td>
                    <td><span className="sku-badge">{p.sku}</span></td>
                    <td>{p.category}</td>
                    <td>₹{Number(p.unit_price).toFixed(2)}</td>
                    <td>
                      <span className={`stock-qty ${p.current_stock <= p.min_stock_alert ? 'stock-low' : 'stock-ok'}`}>
                        {p.current_stock}
                      </span>
                    </td>
                    <td>{p.min_stock_alert}</td>
                    <td>{p.location || '—'}</td>
                    <td>
                      {canWrite(userRole) && (
                        <>
                          <button className="btn-stock-in" onClick={() => setStockModal(p)}>Stock</button>
                          <button className="btn-edit" onClick={() => { setEditId(p.id); setShowForm(true); }}>Edit</button>
                        </>
                      )}
                      {canDelete(userRole) && (
                        <button className="btn-delete" onClick={() => handleDelete(p.id)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan={9} className="no-data">
                    {search ? `No products found for "${search}"` : 'No products yet. Add your first product!'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Movements Tab */}
      {tab === 'movements' && (
        <div className="table-wrapper">
          <table className="customers-table">
            <thead>
              <tr>
                <th>#</th><th>Product</th><th>SKU</th><th>Type</th>
                <th>Quantity</th><th>Reason</th><th>Created By</th><th>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m, i) => (
                <tr key={m.id}>
                  <td>{i + 1}</td>
                  <td><strong>{m.product_name}</strong></td>
                  <td><span className="sku-badge">{m.sku}</span></td>
                  <td>
                    <span className={`movement-badge ${m.movement_type === 'IN' ? 'move-in' : 'move-out'}`}>
                      {m.movement_type === 'IN' ? '↑ IN' : '↓ OUT'}
                    </span>
                  </td>
                  <td><strong>{m.quantity}</strong></td>
                  <td>{m.reason || '—'}</td>
                  <td>{m.created_by}</td>
                  <td>{new Date(m.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr><td colSpan={8} className="no-data">No stock movements recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Products;
