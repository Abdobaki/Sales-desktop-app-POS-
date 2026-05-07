import { useState, useEffect } from 'react';
import { Search, Plus, Mail, Phone, Pencil, Trash2, X } from 'lucide-react';
import { getCustomers, addCustomer, updateCustomer, deleteCustomer, subscribeCustomers, type Customer } from './data/customers';
import { getErrorMessage } from './data/shared';

export function CustomersView() {
  const [customers, setCustomers] = useState<Customer[]>(getCustomers);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [editError, setEditError] = useState('');
  const [addError, setAddError] = useState('');

  useEffect(() => {
    return subscribeCustomers(() => setCustomers(getCustomers()));
  }, []);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    await deleteCustomer(id);
    setDeleteConfirmId(null);
  };

  const handleSaveEdit = async (updated: Customer) => {
    setEditError('');
    try {
      await updateCustomer(updated);
      setEditingCustomer(null);
    } catch (error) {
      setEditError(getErrorMessage(error));
    }
  };

  const handleAddCustomer = async () => {
    if (!newName.trim() || !newPhone.trim()) return;
    setAddError('');
    try {
      await addCustomer({ name: newName.trim(), email: newEmail.trim(), phone: newPhone.trim() });
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setShowAddModal(false);
    } catch (error) {
      setAddError(getErrorMessage(error));
    }
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1>Customers</h1>
          <p className="text-muted-foreground mt-1">Manage customer relationships</p>
        </div>
        <button
          onClick={() => {
            setAddError('');
            setShowAddModal(true);
          }}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md pl-12 pr-4 py-3 bg-input-background border border-border rounded-lg"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filtered.map((customer) => (
          <div key={customer.id} className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3>{customer.name}</h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4" />
                    {customer.email}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4" />
                    {customer.phone}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditError('');
                    setEditingCustomer({ ...customer });
                  }}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {deleteConfirmId === customer.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void handleDelete(customer.id)}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(customer.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-4 border-t border-border">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Total Orders</div>
                <div>{customer.totalOrders}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Total Spent</div>
                <div>${customer.totalSpent.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Last Purchase</div>
                <div>{customer.lastPurchase === '-' ? '-' : new Date(customer.lastPurchase).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2>Edit Customer</h2>
              <button onClick={() => setEditingCustomer(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Name</label>
                <input
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Email</label>
                <input
                  value={editingCustomer.email}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Phone</label>
                <input
                  value={editingCustomer.phone}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg"
                />
              </div>
            </div>
            {editError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {editError}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingCustomer(null)}
                className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSaveEdit(editingCustomer)}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2>Add Customer</h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Name *</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg"
                  placeholder="Customer name"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Phone *</label>
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg"
                  placeholder="(555) 000-0000"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Email <span className="text-xs text-muted-foreground">(optional)</span></label>
                <input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg"
                  placeholder="email@example.com"
                />
              </div>
            </div>
            {addError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {addError}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAddCustomer()}
                disabled={!newName.trim() || !newPhone.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
