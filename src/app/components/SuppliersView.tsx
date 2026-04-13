import { useState, useEffect } from 'react';
import {
  Search, Plus, X, ChevronDown, ChevronRight, Pencil, Trash2, Upload,
  Phone, Mail, MapPin, Building2, Package, Receipt, Eye, Calendar, FileText,
} from 'lucide-react';
import {
  getSuppliers, addSupplier, updateSupplier, deleteSupplier, subscribeSuppliers,
  getPurchasesBySupplier, addPurchase, deletePurchase, subscribePurchases,
  type Supplier, type Purchase,
} from './data/suppliers';

const emptySupplierForm = {
  name: '',
  company: '',
  phone: '',
  email: '',
  address: '',
};

const emptyPurchaseForm = {
  productName: '',
  quantity: '',
  unitPrice: '',
  date: new Date().toISOString().split('T')[0],
  receiptImage: '',
  notes: '',
};

export function SuppliersView() {
  const [suppliers, setSuppliers] = useState(getSuppliers);
  const [, setPurchaseTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [supplierErrors, setSupplierErrors] = useState<Record<string, string>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseForSupplierId, setPurchaseForSupplierId] = useState<string | null>(null);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm);
  const [purchaseErrors, setPurchaseErrors] = useState<Record<string, string>>({});

  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [deletePurchaseConfirmId, setDeletePurchaseConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const unsub1 = subscribeSuppliers(() => setSuppliers(getSuppliers()));
    const unsub2 = subscribePurchases(() => setPurchaseTick((t) => t + 1));
    return () => { unsub1(); unsub2(); };
  }, []);

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Supplier CRUD handlers ──

  const openAddSupplier = () => {
    setSupplierForm(emptySupplierForm);
    setSupplierErrors({});
    setEditingSupplier(null);
    setShowSupplierModal(true);
  };

  const openEditSupplier = (s: Supplier) => {
    setSupplierForm({
      name: s.name,
      company: s.company,
      phone: s.phone,
      email: s.email,
      address: s.address,
    });
    setSupplierErrors({});
    setEditingSupplier(s);
    setShowSupplierModal(true);
  };

  const validateSupplierForm = () => {
    const errors: Record<string, string> = {};
    if (!supplierForm.name.trim()) errors.name = 'Required';
    if (!supplierForm.phone.trim()) errors.phone = 'Required';
    setSupplierErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveSupplier = () => {
    if (!validateSupplierForm()) return;
    if (editingSupplier) {
      updateSupplier({
        ...editingSupplier,
        name: supplierForm.name.trim(),
        company: supplierForm.company.trim(),
        phone: supplierForm.phone.trim(),
        email: supplierForm.email.trim(),
        address: supplierForm.address.trim(),
      });
    } else {
      addSupplier({
        name: supplierForm.name.trim(),
        company: supplierForm.company.trim(),
        phone: supplierForm.phone.trim(),
        email: supplierForm.email.trim(),
        address: supplierForm.address.trim(),
      });
    }
    setShowSupplierModal(false);
  };

  const handleDeleteSupplier = (id: string) => {
    deleteSupplier(id);
    setDeleteConfirmId(null);
    if (expandedId === id) setExpandedId(null);
  };

  const updateSupplierField = (field: string, value: string) => {
    setSupplierForm((prev) => ({ ...prev, [field]: value }));
    if (supplierErrors[field]) setSupplierErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  // ── Purchase handlers ──

  const openAddPurchase = (supplierId: string) => {
    setPurchaseForm(emptyPurchaseForm);
    setPurchaseErrors({});
    setPurchaseForSupplierId(supplierId);
    setShowPurchaseModal(true);
  };

  const validatePurchaseForm = () => {
    const errors: Record<string, string> = {};
    if (!purchaseForm.productName.trim()) errors.productName = 'Required';
    if (!purchaseForm.quantity || isNaN(Number(purchaseForm.quantity)) || Number(purchaseForm.quantity) <= 0) errors.quantity = 'Enter a valid number';
    if (!purchaseForm.unitPrice || isNaN(Number(purchaseForm.unitPrice)) || Number(purchaseForm.unitPrice) <= 0) errors.unitPrice = 'Enter a valid price';
    if (!purchaseForm.date) errors.date = 'Required';
    setPurchaseErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSavePurchase = () => {
    if (!validatePurchaseForm() || !purchaseForSupplierId) return;
    const qty = parseInt(purchaseForm.quantity);
    const unit = parseFloat(purchaseForm.unitPrice);
    addPurchase({
      supplierId: purchaseForSupplierId,
      productName: purchaseForm.productName.trim(),
      quantity: qty,
      unitPrice: unit,
      totalPrice: qty * unit,
      date: purchaseForm.date,
      receiptImage: purchaseForm.receiptImage,
      notes: purchaseForm.notes.trim(),
    });
    setShowPurchaseModal(false);
  };

  const handleDeletePurchase = (id: string) => {
    deletePurchase(id);
    setDeletePurchaseConfirmId(null);
  };

  const updatePurchaseField = (field: string, value: string) => {
    setPurchaseForm((prev) => ({ ...prev, [field]: value }));
    if (purchaseErrors[field]) setPurchaseErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleReceiptUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          updatePurchaseField('receiptImage', ev.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1>Suppliers</h1>
          <p className="text-muted-foreground mt-1">Manage your suppliers and purchase records</p>
        </div>
        <button
          onClick={openAddSupplier}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Supplier
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-input-background border border-border rounded-lg"
          />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Total Suppliers</span>
          </div>
          <div className="text-2xl font-semibold">{suppliers.length}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-muted-foreground">Total Purchases</span>
          </div>
          <div className="text-2xl font-semibold">{suppliers.reduce((s, sup) => s + sup.totalPurchases, 0)}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-muted-foreground">Total Spent</span>
          </div>
          <div className="text-2xl font-semibold">${suppliers.reduce((s, sup) => s + sup.totalSpent, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Supplier List */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground">
            {searchQuery ? 'No suppliers match your search' : 'No suppliers yet. Add your first supplier above.'}
          </div>
        )}

        {filtered.map((supplier) => {
          const isExpanded = expandedId === supplier.id;
          const purchases = isExpanded ? getPurchasesBySupplier(supplier.id) : [];

          return (
            <div key={supplier.id} className="bg-card border border-border rounded-lg overflow-hidden transition-shadow hover:shadow-sm">
              {/* Supplier Header */}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-lg">
                      {supplier.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="truncate">{supplier.name}</h3>
                        {supplier.company && (
                          <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full truncate">
                            {supplier.company}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {supplier.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {supplier.phone}
                          </span>
                        )}
                        {supplier.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {supplier.email}
                          </span>
                        )}
                        {supplier.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {supplier.address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Stats & Actions */}
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <div className="text-right mr-2">
                      <div className="text-sm text-muted-foreground">{supplier.totalPurchases} purchases</div>
                      <div className="text-primary font-medium">${supplier.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <button
                      onClick={() => openAddPurchase(supplier.id)}
                      className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                      title="Add Purchase"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditSupplier(supplier)}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {deleteConfirmId === supplier.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteSupplier(supplier.id)}
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
                        onClick={() => setDeleteConfirmId(supplier.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : supplier.id)}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title={isExpanded ? 'Collapse' : 'View Purchases'}
                    >
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded: Purchases Table */}
              {isExpanded && (
                <div className="border-t border-border">
                  <div className="p-5 bg-muted/30">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm text-muted-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Purchase History — {supplier.name}
                      </h4>
                      <button
                        onClick={() => openAddPurchase(supplier.id)}
                        className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-1.5 text-sm transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New Purchase
                      </button>
                    </div>

                    {purchases.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8 text-sm">
                        No purchases recorded yet for this supplier.
                      </div>
                    ) : (
                      <div className="bg-card border border-border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted/50 border-b border-border">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Date</th>
                              <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Product</th>
                              <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Qty</th>
                              <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Unit Price</th>
                              <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Total</th>
                              <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Notes</th>
                              <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Receipt</th>
                              <th className="px-4 py-2.5"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {purchases
                              .sort((a, b) => b.date.localeCompare(a.date))
                              .map((purchase) => (
                              <tr key={purchase.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                                <td className="px-4 py-3 text-sm">
                                  <span className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                    {new Date(purchase.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm font-medium">{purchase.productName}</td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">{purchase.quantity}</td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">${purchase.unitPrice.toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm font-medium text-primary">${purchase.totalPrice.toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm text-muted-foreground max-w-[160px] truncate">{purchase.notes || '—'}</td>
                                <td className="px-4 py-3">
                                  {purchase.receiptImage ? (
                                    <button
                                      onClick={() => setViewingReceipt(purchase.receiptImage)}
                                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      View
                                    </button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {deletePurchaseConfirmId === purchase.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleDeletePurchase(purchase.id)}
                                        className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                      >
                                        Delete
                                      </button>
                                      <button
                                        onClick={() => setDeletePurchaseConfirmId(null)}
                                        className="text-muted-foreground hover:text-foreground"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeletePurchaseConfirmId(purchase.id)}
                                      className="text-muted-foreground hover:text-red-600 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Add / Edit Supplier Modal ─── */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</h2>
              <button onClick={() => setShowSupplierModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Name *</label>
                  <input
                    value={supplierForm.name}
                    onChange={(e) => updateSupplierField('name', e.target.value)}
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${supplierErrors.name ? 'border-red-400' : 'border-border'}`}
                    placeholder="e.g. Ahmed Benali"
                    autoFocus
                  />
                  {supplierErrors.name && <p className="text-red-500 text-xs mt-1">{supplierErrors.name}</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Company</label>
                  <input
                    value={supplierForm.company}
                    onChange={(e) => updateSupplierField('company', e.target.value)}
                    className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm"
                    placeholder="e.g. Textile Express"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Phone *</label>
                  <input
                    value={supplierForm.phone}
                    onChange={(e) => updateSupplierField('phone', e.target.value)}
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${supplierErrors.phone ? 'border-red-400' : 'border-border'}`}
                    placeholder="(555) 000-0000"
                  />
                  {supplierErrors.phone && <p className="text-red-500 text-xs mt-1">{supplierErrors.phone}</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Email</label>
                  <input
                    value={supplierForm.email}
                    onChange={(e) => updateSupplierField('email', e.target.value)}
                    className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm"
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Address</label>
                <input
                  value={supplierForm.address}
                  onChange={(e) => updateSupplierField('address', e.target.value)}
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm"
                  placeholder="e.g. 45 Industrial Zone, Casablanca"
                />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button
                onClick={() => setShowSupplierModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSupplier}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                {editingSupplier ? 'Save Changes' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Purchase Modal ─── */}
      {showPurchaseModal && purchaseForSupplierId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2>New Purchase</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  For: {suppliers.find((s) => s.id === purchaseForSupplierId)?.name}
                </p>
              </div>
              <button onClick={() => setShowPurchaseModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[65vh] overflow-auto">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Product Name *</label>
                <input
                  value={purchaseForm.productName}
                  onChange={(e) => updatePurchaseField('productName', e.target.value)}
                  className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${purchaseErrors.productName ? 'border-red-400' : 'border-border'}`}
                  placeholder="e.g. Cotton T-Shirt (Bulk)"
                  autoFocus
                />
                {purchaseErrors.productName && <p className="text-red-500 text-xs mt-1">{purchaseErrors.productName}</p>}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Quantity *</label>
                  <input
                    value={purchaseForm.quantity}
                    onChange={(e) => updatePurchaseField('quantity', e.target.value)}
                    type="number"
                    min="1"
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${purchaseErrors.quantity ? 'border-red-400' : 'border-border'}`}
                    placeholder="0"
                  />
                  {purchaseErrors.quantity && <p className="text-red-500 text-xs mt-1">{purchaseErrors.quantity}</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Unit Price *</label>
                  <input
                    value={purchaseForm.unitPrice}
                    onChange={(e) => updatePurchaseField('unitPrice', e.target.value)}
                    type="number"
                    step="0.01"
                    min="0"
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${purchaseErrors.unitPrice ? 'border-red-400' : 'border-border'}`}
                    placeholder="0.00"
                  />
                  {purchaseErrors.unitPrice && <p className="text-red-500 text-xs mt-1">{purchaseErrors.unitPrice}</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Date *</label>
                  <input
                    value={purchaseForm.date}
                    onChange={(e) => updatePurchaseField('date', e.target.value)}
                    type="date"
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${purchaseErrors.date ? 'border-red-400' : 'border-border'}`}
                  />
                  {purchaseErrors.date && <p className="text-red-500 text-xs mt-1">{purchaseErrors.date}</p>}
                </div>
              </div>
              {/* Total preview */}
              {Number(purchaseForm.quantity) > 0 && Number(purchaseForm.unitPrice) > 0 && (
                <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Cost</span>
                  <span className="text-sm font-semibold text-primary">
                    ${(Number(purchaseForm.quantity) * Number(purchaseForm.unitPrice)).toFixed(2)}
                  </span>
                </div>
              )}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Notes</label>
                <textarea
                  value={purchaseForm.notes}
                  onChange={(e) => updatePurchaseField('notes', e.target.value)}
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm resize-none"
                  rows={2}
                  placeholder="Optional notes about this purchase..."
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Receipt Image</label>
                <div
                  onClick={handleReceiptUpload}
                  className="border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
                >
                  {purchaseForm.receiptImage ? (
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img src={purchaseForm.receiptImage} alt="Receipt" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm mb-1">Receipt uploaded</p>
                        <p className="text-xs text-muted-foreground">Click to change</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); updatePurchaseField('receiptImage', ''); }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-2 text-muted-foreground">
                      <Upload className="w-8 h-8 opacity-40" />
                      <p className="text-sm">Click to upload receipt</p>
                      <p className="text-xs">PNG, JPG, PDF up to 5MB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePurchase}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Save Purchase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Receipt Viewer Modal ─── */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setViewingReceipt(null)}>
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-2xl max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm">Receipt Preview</h3>
              <button onClick={() => setViewingReceipt(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[75vh]">
              <img src={viewingReceipt} alt="Receipt" className="max-w-full rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
