import React, { useEffect, useState } from 'react';
import api from '../api';

interface ChallanItem {
  id: number; product_name: string; product_sku: string;
  unit_price: number; quantity: number; total_price: number;
}
interface Challan {
  id: number; challan_number: string; customer_name: string;
  customer_mobile: string; customer_business: string; customer_address: string;
  total_quantity: number; total_amount: number; status: string;
  created_by: string; notes: string; created_at: string; items: ChallanItem[];
}

interface Props { challanId: number; userRole: string; onBack: () => void; onRefresh: () => void; }

const statusColors: Record<string, string> = {
  draft: 'badge-draft', confirmed: 'badge-confirmed', cancelled: 'badge-cancelled'
};

const ChallanDetail: React.FC<Props> = ({ challanId, userRole, onBack, onRefresh }) => {
  const [challan, setChallan] = useState<Challan | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');

  const canManage = userRole === 'admin' || userRole === 'sales';

  useEffect(() => {
    api.get(`/challans/${challanId}`).then(r => setChallan(r.data.data)).catch(() => setError('Failed to load'));
  }, [challanId]);

  const handleStatus = async (status: string) => {
    if (!window.confirm(`${status === 'confirmed' ? 'Confirm' : 'Cancel'} this challan?`)) return;
    setLoading(status); setError('');
    try {
      await api.patch(`/challans/${challanId}/status`, { status });
      const res = await api.get(`/challans/${challanId}`);
      setChallan(res.data.data);
      onRefresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally { setLoading(''); }
  };

  const handlePrint = () => window.print();

  if (!challan) return <div className="loading">Loading challan...</div>;

  return (
    <div className="detail-page">
      {/* Header */}
      <div className="detail-header no-print">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <div className="detail-title">
          <h2>{challan.challan_number}</h2>
          <span className={`badge ${statusColors[challan.status]}`}>{challan.status.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canManage && challan.status === 'draft' && (
            <>
              <button className="btn-primary" disabled={!!loading} onClick={() => handleStatus('confirmed')}>
                {loading === 'confirmed' ? '...' : '✅ Confirm'}
              </button>
              <button className="btn-secondary" disabled={!!loading} onClick={() => handleStatus('cancelled')}>
                ✕ Cancel
              </button>
            </>
          )}
          {canManage && challan.status === 'confirmed' && (
            <button className="btn-secondary" disabled={!!loading} onClick={() => handleStatus('cancelled')}>
              ✕ Cancel & Restore Stock
            </button>
          )}
          <button className="btn-secondary" onClick={handlePrint}>🖨️ Print</button>
        </div>
      </div>

      {error && <div className="error-msg no-print">{error}</div>}

      {/* Printable Challan */}
      <div className="challan-print-area">
        <div className="challan-print-header">
          <div>
            <h2 className="challan-print-title">SALES CHALLAN</h2>
            <p className="challan-print-number">{challan.challan_number}</p>
          </div>
          <div className="challan-print-status">
            <span className={`badge ${statusColors[challan.status]}`}>{challan.status.toUpperCase()}</span>
          </div>
        </div>

        <div className="challan-info-grid">
          <div className="challan-info-box">
            <div className="challan-info-label">Bill To</div>
            <div className="challan-info-value"><strong>{challan.customer_name}</strong></div>
            <div className="challan-info-value">{challan.customer_business}</div>
            <div className="challan-info-value">📱 {challan.customer_mobile}</div>
            <div className="challan-info-value">📍 {challan.customer_address}</div>
          </div>
          <div className="challan-info-box">
            <div className="challan-info-label">Challan Details</div>
            <div className="challan-info-row"><span>Date:</span><strong>{new Date(challan.created_at).toLocaleDateString()}</strong></div>
            <div className="challan-info-row"><span>Created By:</span><strong>{challan.created_by}</strong></div>
            <div className="challan-info-row"><span>Status:</span><strong>{challan.status.toUpperCase()}</strong></div>
          </div>
        </div>

        {/* Items Table */}
        <table className="challan-items-print">
          <thead>
            <tr>
              <th>#</th><th>Product</th><th>SKU</th><th>Unit Price</th><th>Qty</th><th>Total</th>
            </tr>
          </thead>
          <tbody>
            {challan.items.map((item, i) => (
              <tr key={item.id}>
                <td>{i + 1}</td>
                <td>{item.product_name}</td>
                <td><span className="sku-badge">{item.product_sku}</span></td>
                <td>₹{Number(item.unit_price).toFixed(2)}</td>
                <td>{item.quantity}</td>
                <td><strong>₹{Number(item.total_price).toFixed(2)}</strong></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="challan-total-row">
              <td colSpan={4}><strong>Total</strong></td>
              <td><strong>{challan.total_quantity}</strong></td>
              <td><strong>₹{Number(challan.total_amount).toFixed(2)}</strong></td>
            </tr>
          </tfoot>
        </table>

        {challan.notes && (
          <div className="challan-notes-print">
            <strong>Notes:</strong> {challan.notes}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChallanDetail;
