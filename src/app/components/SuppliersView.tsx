import { useState, useEffect } from 'react';
import {
  Search, Plus, X, ChevronDown, ChevronRight, Pencil, Trash2, Upload,
  Phone, Mail, MapPin, Building2, Package, Receipt, Eye, Calendar, FileText, ArrowLeft,
} from 'lucide-react';
import {
  getSuppliers, addSupplier, updateSupplier, deleteSupplier, subscribeSuppliers,
  getPurchasesBySupplier, addPurchase, updatePurchase, deletePurchase, subscribePurchases,
  type Supplier, type Purchase,
} from './data/suppliers';
import { getProducts, subscribeProducts, type Product } from './data/products';
import { getStoreSettings, subscribeSettings, type StoreSettings } from './data/settings';
import { getErrorMessage } from './data/shared';

const emptySupplierForm = {
  name: '',
  company: '',
  phone: '',
  email: '',
  address: '',
};

const emptyPurchaseForm = {
  productId: '',
  productName: '',
  quantity: '',
  unitPrice: '',
  date: new Date().toISOString().split('T')[0],
  receiptImage: '',
  notes: '',
};

function formatCurrency(amount: number, currencyCode: string) {
  const code = (currencyCode || 'DZD').toUpperCase();
  const suffix = code === 'DZD' ? 'DZ' : code;
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} ${suffix}`;
}

export function SuppliersView() {
  const [suppliers, setSuppliers] = useState(getSuppliers);
  const [products, setProducts] = useState<Product[]>(getProducts);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(getStoreSettings());
  const [, setPurchaseTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [supplierErrors, setSupplierErrors] = useState<Record<string, string>>({});
  const [supplierSaveError, setSupplierSaveError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseForSupplierId, setPurchaseForSupplierId] = useState<string | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm);
  const [purchaseErrors, setPurchaseErrors] = useState<Record<string, string>>({});
  const [purchaseSaveError, setPurchaseSaveError] = useState('');

  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [deletePurchaseConfirmId, setDeletePurchaseConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const unsub1 = subscribeSuppliers(() => setSuppliers(getSuppliers()));
    const unsub2 = subscribePurchases(() => setPurchaseTick((t) => t + 1));
    const unsub3 = subscribeProducts(() => setProducts(getProducts()));
    const unsub4 = subscribeSettings(() => setStoreSettings(getStoreSettings()));
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, []);

  const filtered = suppliers.filter((s) => {
    const matchesSupplier =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase());
      
    if (!matchesSupplier) return false;

    if (productSearchQuery.trim()) {
      const supplierPurchases = getPurchasesBySupplier(s.id);
      const matchesProduct = supplierPurchases.some(p => 
        p.productName.toLowerCase().includes(productSearchQuery.trim().toLowerCase())
      );
      if (!matchesProduct) return false;
    }

    return true;
  });

  // ── Supplier CRUD handlers ──

  const openAddSupplier = () => {
    setSupplierForm(emptySupplierForm);
    setSupplierErrors({});
    setSupplierSaveError('');
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
    setSupplierSaveError('');
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

  const handleSaveSupplier = async () => {
    if (!validateSupplierForm()) return;
    setSupplierSaveError('');

    try {
      if (editingSupplier) {
        await updateSupplier({
          ...editingSupplier,
          name: supplierForm.name.trim(),
          company: supplierForm.company.trim(),
          phone: supplierForm.phone.trim(),
          email: supplierForm.email.trim(),
          address: supplierForm.address.trim(),
        });
      } else {
        await addSupplier({
          name: supplierForm.name.trim(),
          company: supplierForm.company.trim(),
          phone: supplierForm.phone.trim(),
          email: supplierForm.email.trim(),
          address: supplierForm.address.trim(),
        });
      }
      setShowSupplierModal(false);
    } catch (error) {
      setSupplierSaveError(getErrorMessage(error));
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    await deleteSupplier(id);
    setDeleteConfirmId(null);
    if (selectedSupplierId === id) setSelectedSupplierId(null);
  };

  const updateSupplierField = (field: string, value: string) => {
    setSupplierForm((prev) => ({ ...prev, [field]: value }));
    if (supplierErrors[field]) setSupplierErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  // ── Purchase handlers ──

  const openAddPurchase = (supplierId: string) => {
    const firstProduct = products[0] ?? null;
    setPurchaseForm({
      ...emptyPurchaseForm,
      productId: firstProduct?.id ?? '',
      productName: firstProduct?.name ?? '',
      unitPrice: firstProduct ? String(firstProduct.costPrice) : '',
    });
    setPurchaseErrors({});
    setPurchaseSaveError('');
    setPurchaseForSupplierId(supplierId);
    setEditingPurchase(null);
    setShowPurchaseModal(true);
  };



  const openEditPurchase = (purchase: Purchase) => {
    const linkedProduct = purchase.productId
      ? products.find((product) => product.id === purchase.productId)
      : products.find((product) => product.name === purchase.productName);

    setPurchaseForm({
      productId: linkedProduct?.id ?? purchase.productId ?? '',
      productName: purchase.productName,
      quantity: purchase.quantity.toString(),
      unitPrice: purchase.unitPrice.toString(),
      date: purchase.date,
      receiptImage: purchase.receiptImage,
      notes: purchase.notes,
    });
    setPurchaseErrors({});
    setPurchaseSaveError('');
    setPurchaseForSupplierId(purchase.supplierId);
    setEditingPurchase(purchase);
    setShowPurchaseModal(true);
  };

  const validatePurchaseForm = () => {
    const errors: Record<string, string> = {};
    if (!purchaseForm.productId) errors.productId = 'Select a product';
    if (!purchaseForm.quantity || isNaN(Number(purchaseForm.quantity)) || Number(purchaseForm.quantity) <= 0) errors.quantity = 'Enter a valid number';
    if (!purchaseForm.unitPrice || isNaN(Number(purchaseForm.unitPrice)) || Number(purchaseForm.unitPrice) <= 0) errors.unitPrice = 'Enter a valid price';
    if (!purchaseForm.date) errors.date = 'Required';
    setPurchaseErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSavePurchase = async () => {
    if (!validatePurchaseForm() || !purchaseForSupplierId) return;
    const qty = parseInt(purchaseForm.quantity);
    const unit = parseFloat(purchaseForm.unitPrice);
    const selectedProduct = products.find((product) => product.id === purchaseForm.productId);
    if (!selectedProduct) {
      setPurchaseErrors((prev) => ({ ...prev, productId: 'Select a valid product' }));
      return;
    }
    const productName = selectedProduct.name;
    
    setPurchaseSaveError('');

    try {
      if (editingPurchase) {
        await updatePurchase({
          ...editingPurchase,
          productId: selectedProduct.id,
          productName,
          quantity: qty,
          unitPrice: unit,
          totalPrice: qty * unit,
          date: purchaseForm.date,
          receiptImage: purchaseForm.receiptImage,
          notes: purchaseForm.notes.trim(),
        });
      } else {
        await addPurchase({
          supplierId: purchaseForSupplierId,
          productId: selectedProduct.id,
          productName,
          quantity: qty,
          unitPrice: unit,
          totalPrice: qty * unit,
          date: purchaseForm.date,
          receiptImage: purchaseForm.receiptImage,
          notes: purchaseForm.notes.trim(),
        });
      }
      setShowPurchaseModal(false);
    } catch (error) {
      setPurchaseSaveError(getErrorMessage(error));
    }
  };

  const handleDeletePurchase = async (id: string) => {
    await deletePurchase(id);
    setDeletePurchaseConfirmId(null);
  };

  const updatePurchaseField = (field: string, value: string) => {
    setPurchaseForm((prev) => ({ ...prev, [field]: value }));
    if (purchaseErrors[field]) setPurchaseErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleProductSelection = (productId: string) => {
    const selectedProduct = products.find((product) => product.id === productId);
    setPurchaseForm((prev) => ({
      ...prev,
      productId,
      productName: selectedProduct?.name ?? '',
      unitPrice: selectedProduct ? String(selectedProduct.costPrice) : prev.unitPrice,
    }));
    if (purchaseErrors.productId) {
      setPurchaseErrors((prev) => {
        const next = { ...prev };
        delete next.productId;
        return next;
      });
    }
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

  const selectedSupplier = selectedSupplierId ? suppliers.find((s) => s.id === selectedSupplierId) : null;

  return (
    <div className="flex-1 p-8 overflow-auto">
      {selectedSupplier ? (
        <div className="space-y-6 max-w-5xl mx-auto">
          {/* Back button and title */}
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => setSelectedSupplierId(null)}
              className="p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold">{selectedSupplier.name}</h1>
              <p className="text-muted-foreground mt-1">Purchase History & Details</p>
            </div>
          </div>

          {/* Supplier Info Card */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-6">
             <div className="flex items-start gap-5">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-2xl">
                  {selectedSupplier.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                   <h2 className="text-xl font-semibold mb-2">{selectedSupplier.company || selectedSupplier.name}</h2>
                   <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                      {selectedSupplier.phone && (
                        <span className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {selectedSupplier.phone}
                        </span>
                      )}
                      {selectedSupplier.email && (
                        <span className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          {selectedSupplier.email}
                        </span>
                      )}
                      {selectedSupplier.address && (
                        <span className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {selectedSupplier.address}
                        </span>
                      )}
                   </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <div className="text-sm text-muted-foreground mb-1">{selectedSupplier.totalPurchases} Total Purchases</div>
                   <div className="text-2xl font-bold text-primary">{formatCurrency(selectedSupplier.totalSpent, storeSettings.currencyCode)}</div>
                </div>
             </div>
          </div>

          {/* Purchases Table */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
              <h3 className="flex items-center gap-2 text-lg font-medium">
                <FileText className="w-5 h-5 text-muted-foreground" />
                Purchases
              </h3>
              <button
                onClick={() => openAddPurchase(selectedSupplier.id)}
                disabled={products.length === 0}
                className="px-3.5 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add Purchase
              </button>
            </div>
            
            {(() => {
              const purchases = getPurchasesBySupplier(selectedSupplier.id);
              if (purchases.length === 0) {
                return (
                  <div className="text-center text-muted-foreground py-16">
                    <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                    </div>
                    <p>No purchases recorded yet for this supplier.</p>
                  </div>
                );
              }
              return (
                 <div className="overflow-x-auto">
                   <table className="w-full">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium uppercase tracking-wider">Date</th>
                          <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium uppercase tracking-wider">Product</th>
                          <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium uppercase tracking-wider">Qty</th>
                          <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium uppercase tracking-wider">Unit Price</th>
                          <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium uppercase tracking-wider">Total</th>
                          <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium uppercase tracking-wider">Notes</th>
                          <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium uppercase tracking-wider">Receipt</th>
                          <th className="px-5 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((purchase) => (
                          <tr key={purchase.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-5 py-4 text-sm whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                {new Date(purchase.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-sm font-medium">{purchase.productName}</td>
                            <td className="px-5 py-4 text-sm text-muted-foreground">{purchase.quantity}</td>
                            <td className="px-5 py-4 text-sm text-muted-foreground">{formatCurrency(purchase.unitPrice, storeSettings.currencyCode)}</td>
                            <td className="px-5 py-4 text-sm font-medium text-primary">{formatCurrency(purchase.totalPrice, storeSettings.currencyCode)}</td>
                            <td className="px-5 py-4 text-sm text-muted-foreground max-w-[200px] truncate" title={purchase.notes}>{purchase.notes || '—'}</td>
                            <td className="px-5 py-4">
                              {purchase.receiptImage ? (
                                <button
                                  onClick={() => setViewingReceipt(purchase.receiptImage)}
                                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline bg-primary/10 px-2.5 py-1 rounded-md"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  View
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground px-2.5 py-1">—</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right">
                              {deletePurchaseConfirmId === purchase.id ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => void handleDeletePurchase(purchase.id)}
                                    className="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeletePurchaseConfirmId(null)}
                                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => openEditPurchase(purchase)}
                                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors inline-block"
                                    title="Edit"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setDeletePurchaseConfirmId(purchase.id)}
                                    className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-md transition-colors inline-block"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                 </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <>
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
          <div className="mb-6 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by supplier name, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-input-background border border-border rounded-lg shadow-sm focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
              />
            </div>
            <div className="relative flex-1 max-w-md">
              <Package className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by product name or barcode..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-input-background border border-border rounded-lg shadow-sm focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
              />
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-border rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">Total Suppliers</span>
              </div>
              <div className="text-2xl font-semibold">{suppliers.length}</div>
            </div>
            <div className="bg-card border border-border rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-sm text-muted-foreground">Total Purchases</span>
              </div>
              <div className="text-2xl font-semibold">{suppliers.reduce((s, sup) => s + sup.totalPurchases, 0)}</div>
            </div>
            <div className="bg-card border border-border rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-sm text-muted-foreground">Total Spent</span>
              </div>
               <div className="text-2xl font-semibold">{formatCurrency(suppliers.reduce((s, sup) => s + sup.totalSpent, 0), storeSettings.currencyCode)}</div>
            </div>
          </div>

          {/* Supplier List */}
          <div className="space-y-4">
            {filtered.length === 0 && (
              <div className="bg-card border border-border rounded-xl border-dashed p-12 text-center text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                {searchQuery ? 'No suppliers match your search' : 'No suppliers yet. Add your first supplier above.'}
              </div>
            )}

            {filtered.map((supplier) => (
              <div key={supplier.id} className="bg-card border border-border rounded-xl overflow-hidden transition-shadow shadow-sm hover:shadow-md cursor-pointer group" onClick={() => setSelectedSupplierId(supplier.id)}>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-xl">
                        {supplier.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1.5">
                          <h3 className="truncate text-lg font-medium group-hover:text-primary transition-colors">{supplier.name}</h3>
                          {supplier.company && (
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full truncate border border-border/50">
                              {supplier.company}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                          {supplier.phone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5" />
                              {supplier.phone}
                            </span>
                          )}
                          {supplier.email && (
                            <span className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5" />
                              {supplier.email}
                            </span>
                          )}
                          {supplier.address && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" />
                              {supplier.address}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Stats & Actions */}
                    <div className="flex items-center gap-4 flex-shrink-0 ml-6">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">{supplier.totalPurchases} purchases</div>
                        <div className="text-primary font-medium text-base">{formatCurrency(supplier.totalSpent, storeSettings.currencyCode)}</div>
                      </div>
                      
                      <div className="h-8 w-px bg-border mx-2"></div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>

                        <button
                          onClick={() => openEditSupplier(supplier)}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit Supplier"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {deleteConfirmId === supplier.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => void handleDeleteSupplier(supplier.id)}
                              className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm"
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
                            title="Delete Supplier"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedSupplierId(supplier.id)}
                          className="p-2 ml-1 bg-muted rounded-lg text-foreground hover:bg-primary hover:text-primary-foreground shadow-sm transition-colors"
                          title="View Details"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─── Add / Edit Supplier Modal ─── */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-xl font-semibold">{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</h2>
              <button onClick={() => setShowSupplierModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Name <span className="text-red-500">*</span></label>
                  <input
                    value={supplierForm.name}
                    onChange={(e) => updateSupplierField('name', e.target.value)}
                    className={`w-full px-3.5 py-2.5 bg-input-background border rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-primary outline-none transition-all ${supplierErrors.name ? 'border-red-400' : 'border-border'}`}
                    placeholder="e.g. Ahmed Benali"
                    autoFocus
                  />
                  {supplierErrors.name && <p className="text-red-500 text-xs mt-1.5">{supplierErrors.name}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Company</label>
                  <input
                    value={supplierForm.company}
                    onChange={(e) => updateSupplierField('company', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-input-background border border-border rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                    placeholder="e.g. Textile Express"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Phone <span className="text-red-500">*</span></label>
                  <input
                    value={supplierForm.phone}
                    onChange={(e) => updateSupplierField('phone', e.target.value)}
                    className={`w-full px-3.5 py-2.5 bg-input-background border rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-primary outline-none transition-all ${supplierErrors.phone ? 'border-red-400' : 'border-border'}`}
                    placeholder="(555) 000-0000"
                  />
                  {supplierErrors.phone && <p className="text-red-500 text-xs mt-1.5">{supplierErrors.phone}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Email</label>
                  <input
                    value={supplierForm.email}
                    onChange={(e) => updateSupplierField('email', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-input-background border border-border rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Address</label>
                <input
                  value={supplierForm.address}
                  onChange={(e) => updateSupplierField('address', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-input-background border border-border rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                  placeholder="e.g. 45 Industrial Zone, Casablanca"
                />
              </div>
            </div>
            {supplierSaveError && (
              <div className="mx-5 mb-3 -mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {supplierSaveError}
              </div>
            )}
            <div className="flex gap-3 p-5 border-t border-border bg-muted/20">
              <button
                onClick={() => setShowSupplierModal(false)}
                className="flex-1 py-2.5 bg-background border border-border rounded-lg font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSaveSupplier()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:opacity-90 transition-opacity"
              >
                {editingSupplier ? 'Save Changes' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Purchase Modal ─── */}
      {showPurchaseModal && purchaseForSupplierId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="text-xl font-semibold">{editingPurchase ? 'Edit Purchase' : 'New Purchase'}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  For: <span className="font-medium text-foreground">{suppliers.find((s) => s.id === purchaseForSupplierId)?.name}</span>
                </p>
              </div>
              <button onClick={() => setShowPurchaseModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Product <span className="text-red-500">*</span></label>
                <select
                  value={purchaseForm.productId}
                  onChange={(e) => handleProductSelection(e.target.value)}
                  className={`w-full px-3.5 py-2.5 bg-input-background border rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-primary outline-none transition-all ${purchaseErrors.productId ? 'border-red-400' : 'border-border'}`}
                  autoFocus
                >
                  <option value="">Select product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </select>
                {purchaseErrors.productId && <p className="text-red-500 text-xs mt-1.5">{purchaseErrors.productId}</p>}
                {products.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1.5">No products found in inventory. Add products first to record purchases.</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Quantity <span className="text-red-500">*</span></label>
                  <input
                    value={purchaseForm.quantity}
                    onChange={(e) => updatePurchaseField('quantity', e.target.value)}
                    type="number"
                    min="1"
                    className={`w-full px-3.5 py-2.5 bg-input-background border rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-primary outline-none transition-all ${purchaseErrors.quantity ? 'border-red-400' : 'border-border'}`}
                    placeholder="0"
                  />
                  {purchaseErrors.quantity && <p className="text-red-500 text-xs mt-1.5">{purchaseErrors.quantity}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Unit Price <span className="text-red-500">*</span></label>
                  <input
                    value={purchaseForm.unitPrice}
                    onChange={(e) => updatePurchaseField('unitPrice', e.target.value)}
                    type="number"
                    step="0.01"
                    min="0"
                    className={`w-full px-3.5 py-2.5 bg-input-background border rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-primary outline-none transition-all ${purchaseErrors.unitPrice ? 'border-red-400' : 'border-border'}`}
                    placeholder="0.00"
                  />
                  {purchaseErrors.unitPrice && <p className="text-red-500 text-xs mt-1.5">{purchaseErrors.unitPrice}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Date <span className="text-red-500">*</span></label>
                  <input
                    value={purchaseForm.date}
                    onChange={(e) => updatePurchaseField('date', e.target.value)}
                    type="date"
                    className={`w-full px-3.5 py-2.5 bg-input-background border rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-primary outline-none transition-all ${purchaseErrors.date ? 'border-red-400' : 'border-border'}`}
                  />
                  {purchaseErrors.date && <p className="text-red-500 text-xs mt-1.5">{purchaseErrors.date}</p>}
                </div>
              </div>
              {/* Total preview */}
              {Number(purchaseForm.quantity) > 0 && Number(purchaseForm.unitPrice) > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-primary/80">Total Cost</span>
                    <span className="text-lg font-bold text-primary">
                     {formatCurrency(Number(purchaseForm.quantity) * Number(purchaseForm.unitPrice), storeSettings.currencyCode)}
                   </span>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Notes</label>
                <textarea
                  value={purchaseForm.notes}
                  onChange={(e) => updatePurchaseField('notes', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-input-background border border-border rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
                  rows={2}
                  placeholder="Optional notes about this purchase..."
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Receipt Image</label>
                <div
                  onClick={handleReceiptUpload}
                  className="border-2 border-dashed border-border rounded-lg p-5 cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-all group"
                >
                  {purchaseForm.receiptImage ? (
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-background border border-border flex-shrink-0 shadow-sm">
                        <img src={purchaseForm.receiptImage} alt="Receipt" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Receipt uploaded</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Click anywhere to change</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); updatePurchaseField('receiptImage', ''); }}
                        className="p-2 bg-background border border-border rounded-lg text-muted-foreground hover:text-red-500 hover:border-red-200 transition-colors shadow-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-3 text-muted-foreground group-hover:text-foreground transition-colors">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-1 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-medium">Click to upload receipt</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG, PDF up to 5MB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {purchaseSaveError && (
              <div className="mx-5 mb-3 -mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {purchaseSaveError}
              </div>
            )}
            <div className="flex gap-3 p-5 border-t border-border bg-muted/20">
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="flex-1 py-2.5 bg-background border border-border rounded-lg font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSavePurchase()}
                disabled={products.length === 0}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingPurchase ? 'Save Changes' : 'Save Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Receipt Viewer Modal ─── */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewingReceipt(null)}>
          <div className="bg-background border border-border rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <h3 className="font-medium">Receipt Preview</h3>
              <button onClick={() => setViewingReceipt(null)} className="p-1 text-muted-foreground hover:text-foreground bg-background border border-border rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-start justify-center bg-muted/10">
              <img src={viewingReceipt} alt="Receipt" className="max-w-full rounded-lg border border-border shadow-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
