import { useState, useEffect } from 'react';
import { Search, UserPlus, X, Check } from 'lucide-react';
import { getCustomers, addCustomer, subscribeCustomers, type Customer } from './data/customers';
import { getErrorMessage } from './data/shared';

type Props = {
  selectedCustomer: Customer | null;
  onSelect: (c: Customer | null) => void;
  onClose: () => void;
};

export function CustomerPicker({ selectedCustomer, onSelect, onClose }: Props) {
  const [customers, setCustomers] = useState(getCustomers);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    return subscribeCustomers(() => setCustomers(getCustomers()));
  }, []);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const handleCreateCustomer = async () => {
    if (!newName.trim()) return;
    setCreateError('');
    try {
      const c = await addCustomer({ name: newName.trim(), email: newEmail.trim(), phone: newPhone.trim() });
      onSelect(c);
      onClose();
    } catch (error) {
      setCreateError(getErrorMessage(error));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg">Select Customer</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!showNew ? (
          <>
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-input-background border border-border rounded-lg text-sm"
                  autoFocus
                />
              </div>

              {/* Skip / Walk-in option */}
              <button
                onClick={() => { onSelect(null); onClose(); }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                  selectedCustomer === null
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
                  ?
                </div>
                <div className="flex-1">
                  <div className="text-sm">Walk-in Customer</div>
                  <div className="text-xs text-muted-foreground">Skip customer selection</div>
                </div>
              </button>
            </div>

            <div className="max-h-56 overflow-auto px-4 space-y-2">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { onSelect(c); onClose(); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                    selectedCustomer?.id === c.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm">
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.email} &middot; {c.phone}</div>
                  </div>
                  {selectedCustomer?.id === c.id && <Check className="w-5 h-5 text-primary" />}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-4">No customers found</div>
              )}
            </div>

            <div className="p-4 border-t border-border">
              <button
                onClick={() => {
                  setCreateError('');
                  setShowNew(true);
                }}
                className="w-full py-3 flex items-center justify-center gap-2 border border-dashed border-border rounded-lg hover:border-primary hover:text-primary transition-colors text-sm"
              >
                <UserPlus className="w-5 h-5" />
                Create New Customer
              </button>
            </div>
          </>
        ) : (
          <div className="p-4 space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Name *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm"
                placeholder="Customer name"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Email</label>
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Phone</label>
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm"
                placeholder="(555) 000-0000"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowNew(false)}
                className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors text-sm"
              >
                Back
              </button>
              <button
                onClick={() => void handleCreateCustomer()}
                disabled={!newName.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm"
              >
                Create & Select
              </button>
            </div>
            {createError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
