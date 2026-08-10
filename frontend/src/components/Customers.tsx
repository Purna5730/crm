import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import CustomerForm from './CustomerForm';
import CustomerDetail from './CustomerDetail';

interface Customer {
  id: number; name: string; mobile: string; email: string;
  business_name: string; customer_type: string; status: string; follow_up_date: string;
}

interface Props { userRole: string; }

const canWrite = (role: string) => role === 'admin' || role === 'sales';
const canDelete = (role: string) => role === 'admin';

type View = 'list' | 'detail';

const Customers: React.FC<Props> = ({ userRole }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('list');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await api.get('/customers', { params: { search } });
      setCustomers(res.data.data);
    } catch { setError('Failed to load customers'); }
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this customer?')) return;
    try {
      await api.delete(`/customers/${id}`);
      fetchCustomers();
    } catch (err: any) { setError(err.response?.data?.message || 'Delete failed'); }
  };

  const handleFormSuccess = () => { setShowForm(false); setEditId(null); fetchCustomers(); };
  };

  const handleFormSuccess = () => { setShowForm(false); setEditId(null); fetchCustomers(); };

  const typeColors: Record<string, string> = { retail: 'type-retail', wholesale: 'type-wholesale', distributor: 'type-distributor' };

  if (view === 'detail' && selectedId) {
    return (
      <>
        {showForm && (
          <CustomerForm
            customerId={editId}
            onSuccess={() => { setShowForm(false); setEditId(null); }}
            onCancel={() => { setShowForm(false); setEditId(null); }}
          />
        )}
        <CustomerDetail
          customerId={selectedId}
          userRole={userRole}
          onBack={() => { setView('list'); setSelectedId(null); }}
          onEdit={() => { setEditId(selectedId); setShowForm(true); }}
        />
      </>
    );
  }

  return (
    <div className="customers-container">
      {showForm && (
        <CustomerForm
          customerId={editId}
          onSuccess={handleFormSuccess}
          onCancel={() => { setShowForm(false); setEditId(null); }}
        />
      )}

      {/* Header */}
      <div className="customers-header">
        <h2>Customers <span className="count-badge">{customers.length}</span></h2>
        {canWrite(userRole) && (
          <button className="btn-primary" onClick={() => { setEditId(null); setShowForm(true); }}>
            + Add Customer
          </button>
        )}
      </div>

      {/* Search */}
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          placeholder="Search by name, mobile, email or business..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Table */}
      <div className="table-wrapper">
        <table className="customers-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Business</th>
              <th>Type</th>
              <th>Status</th>
              <th>Follow-up</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => (
              <tr key={c.id}>
                <td>{i + 1}</td>
                <td>
                  <span className="customer-name-link" onClick={() => { setSelectedId(c.id); setView('detail'); }}>
                    {c.name}
                  </span>
                </td>
                <td>{c.mobile}</td>
                <td>{c.business_name}</td>
                <td><span className={`badge ${typeColors[c.customer_type]}`}>{c.customer_type}</span></td>
                <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                <td>{c.follow_up_date ? new Date(c.follow_up_date).toLocaleDateString() : '—'}</td>
                <td>
                  <button className="btn-view" onClick={() => { setSelectedId(c.id); setView('detail'); }}>View</button>
                  {canWrite(userRole) && (
                    <button className="btn-edit" onClick={() => { setEditId(c.id); setShowForm(true); }}>Edit</button>
                  )}
                  {canDelete(userRole) && (
                    <button className="btn-delete" onClick={() => handleDelete(c.id)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={8} className="no-data">
                {search ? `No customers found for "${search}"` : 'No customers yet. Add your first customer!'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Customers;
