import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import ChallanForm from './ChallanForm';
import ChallanDetail from './ChallanDetail';

interface Challan {
  id: number; challan_number: string; customer_name: string; customer_business: string;
  total_quantity: number; total_amount: number; status: string;
  created_by: string; item_count: number; created_at: string;
}

interface Props { userRole: string; }

const canCreate = (role: string) => role === 'admin' || role === 'sales';
const statusColors: Record<string, string> = {
  draft: 'badge-draft', confirmed: 'badge-confirmed', cancelled: 'badge-cancelled'
};

const Challans: React.FC<Props> = ({ userRole }) => {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const fetchChallans = useCallback(async () => {
    try {
      const res = await api.get('/challans', { params: { search, status: statusFilter } });
      setChallans(res.data);
    } catch { setError('Failed to load challans'); }
  }, [search, statusFilter]);

  useEffect(() => { fetchChallans(); }, [fetchChallans]);

  if (selectedId) {
    return (
      <ChallanDetail
        challanId={selectedId}
        userRole={userRole}
        onBack={() => setSelectedId(null)}
        onRefresh={fetchChallans}
      />
    );
  }

  const counts = {
    all: challans.length,
    draft: challans.filter(c => c.status === 'draft').length,
    confirmed: challans.filter(c => c.status === 'confirmed').length,
    cancelled: challans.filter(c => c.status === 'cancelled').length,
  };

  return (
    <div className="customers-container">
      {showForm && (
        <ChallanForm
          onSuccess={() => { setShowForm(false); fetchChallans(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Header */}
      <div className="customers-header">
        <h2>Sales Challans <span className="count-badge">{challans.length}</span></h2>
        {canCreate(userRole) && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ New Challan</button>
        )}
      </div>

      {/* Status Summary Cards */}
      <div className="challan-stat-cards">
        {(['all', 'draft', 'confirmed', 'cancelled'] as const).map(s => (
          <div
            key={s}
            className={`challan-stat-card stat-${s} ${statusFilter === (s === 'all' ? '' : s) ? 'stat-active' : ''}`}
            onClick={() => setStatusFilter(s === 'all' ? '' : s)}
          >
            <span className="stat-count">{counts[s]}</span>
            <span className="stat-label">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          placeholder="Search by challan number, customer or business..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Table */}
      <div className="table-wrapper">
        <table className="customers-table">
          <thead>
            <tr>
              <th>#</th><th>Challan No.</th><th>Customer</th><th>Business</th>
              <th>Items</th><th>Total Qty</th><th>Amount</th><th>Status</th>
              <th>Created By</th><th>Date</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {challans.map((c, i) => (
              <tr key={c.id}>
                <td>{i + 1}</td>
                <td>
                  <span className="challan-number-link" onClick={() => setSelectedId(c.id)}>
                    {c.challan_number}
                  </span>
                </td>
                <td>{c.customer_name}</td>
                <td>{c.customer_business}</td>
                <td>{c.item_count}</td>
                <td>{c.total_quantity}</td>
                <td><strong>₹{Number(c.total_amount).toFixed(2)}</strong></td>
                <td><span className={`badge ${statusColors[c.status]}`}>{c.status.toUpperCase()}</span></td>
                <td>{c.created_by}</td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
                <td>
                  <button className="btn-view" onClick={() => setSelectedId(c.id)}>View</button>
                </td>
              </tr>
            ))}
            {challans.length === 0 && (
              <tr><td colSpan={11} className="no-data">
                {search ? `No challans found for "${search}"` : 'No challans yet. Create your first challan!'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Challans;
