import React, { useEffect, useMemo, useState } from 'react';
import { 
  Search, 
  Filter, 
  Pencil, 
  Trash2, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownLeft,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
import { 
  fetchHistory, 
  getHistory, 
  subscribeHistory, 
  updateHistoryRecord, 
  deleteHistoryRecord,
  type HistoryRecord 
} from './data/history';
import { getProducts, type Product } from './data/products';
import { ProductPicker } from './ProductPicker';
import { formatCurrency } from './data/shared';

export function HistoryView() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'purchase'>('all');
  const [products, setProducts] = useState<Product[]>(getProducts());
  
  // Modals
  const [editingRecord, setEditingRecord] = useState<HistoryRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<HistoryRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchHistory();
    const unsubHistory = subscribeHistory(() => setHistory(getHistory()));
    return () => {
      unsubHistory();
    };
  }, []);

  const filteredHistory = useMemo(() => {
    return history.filter(record => {
      const matchesSearch = 
        record.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.customerOrSupplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (record.receiptNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      
      const matchesType = typeFilter === 'all' || record.type === typeFilter;
      
      return matchesSearch && matchesType;
    });
  }, [history, searchQuery, typeFilter]);

  const handleDelete = async () => {
    if (!deletingRecord) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteHistoryRecord(deletingRecord);
      setDeletingRecord(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete record');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operation History</h1>
          <p className="text-muted-foreground mt-2">
            View and manage all sales and purchase operations.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by product, customer, supplier or receipt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-input-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex bg-muted p-1 rounded-lg border border-border">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                typeFilter === 'all' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTypeFilter('sale')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                typeFilter === 'sale' ? 'bg-background shadow-sm text-green-600' : 'hover:bg-background/50'
              }`}
            >
              Sales
            </button>
            <button
              onClick={() => setTypeFilter('purchase')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                typeFilter === 'purchase' ? 'bg-background shadow-sm text-blue-600' : 'hover:bg-background/50'
              }`}
            >
              Purchases
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-6 py-4 font-semibold text-sm">Date</th>
              <th className="px-6 py-4 font-semibold text-sm">Type</th>
              <th className="px-6 py-4 font-semibold text-sm">Product</th>
              <th className="px-6 py-4 font-semibold text-sm">Qty</th>
              <th className="px-6 py-4 font-semibold text-sm text-right">Unit Price</th>
              <th className="px-6 py-4 font-semibold text-sm text-right">Total</th>
              <th className="px-6 py-4 font-semibold text-sm">Entity</th>
              <th className="px-6 py-4 font-semibold text-sm text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map((record) => (
              <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {record.date}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    record.type === 'sale' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {record.type === 'sale' ? (
                      <><ArrowUpRight className="w-3 h-3" /> Sale</>
                    ) : (
                      <><ArrowDownLeft className="w-3 h-3" /> Purchase</>
                    )}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-medium">
                  <div>{record.productName}</div>
                  {record.receiptNumber && (
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      #{record.receiptNumber}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">{record.quantity}</td>
                <td className="px-6 py-4 text-sm text-right font-mono">
                  {formatCurrency(record.unitPrice)}
                </td>
                <td className="px-6 py-4 text-sm text-right font-bold font-mono">
                  {formatCurrency(record.totalPrice)}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {record.customerOrSupplier}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setEditingRecord(record)}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                      title="Edit record"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setDeletingRecord(record)}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredHistory.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-20 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Filter className="w-8 h-8 opacity-20" />
                    <p>No records found matching your filters.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingRecord && (
        <EditRecordModal 
          record={editingRecord} 
          onClose={() => setEditingRecord(null)} 
          products={products}
        />
      )}

      {/* Delete Confirmation */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-destructive">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold">Confirm Deletion</h2>
            </div>
            
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete this <span className="font-semibold text-foreground">{deletingRecord.type}</span> record? 
              This action will <span className="font-semibold text-foreground underline decoration-destructive">reverse the stock adjustment</span> and cannot be undone.
            </p>

            {error && (
              <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setDeletingRecord(null)}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border hover:bg-muted font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? 'Deleting...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditRecordModal({ record, onClose, products }: { record: HistoryRecord, onClose: () => void, products: Product[] }) {
  const [quantity, setQuantity] = useState(record.quantity.toString());
  const [unitPrice, setUnitPrice] = useState(record.unitPrice.toString());
  const [unitCost, setUnitCost] = useState(record.unitCost.toString());
  const [productId, setProductId] = useState(record.productId || '');
  const [productName, setProductName] = useState(record.productName);
  const [date, setDate] = useState(record.date);
  const [notes, setNotes] = useState(record.notes);
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPrice = useMemo(() => {
    const q = parseFloat(quantity) || 0;
    const p = parseFloat(unitPrice) || 0;
    return q * p;
  }, [quantity, unitPrice]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await updateHistoryRecord(record, {
        quantity: parseInt(quantity),
        unitPrice: parseFloat(unitPrice),
        unitCost: parseFloat(unitCost),
        productId: productId || undefined,
        productName: productName,
        date: date,
        notes: notes
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update record');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <h2 className="text-xl font-bold">Edit Operation</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Updating this record will automatically adjust inventory levels.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-6">
            {/* Product Selection */}
            <div className="col-span-2">
              <label className="text-sm font-semibold mb-2 block">Product</label>
              <ProductPicker 
                products={products}
                selectedProductId={productId}
                onSelect={(p) => {
                  setProductId(p.id);
                  setProductName(p.name);
                  if (record.type === 'purchase') {
                    setUnitCost(p.costPrice.toString());
                  } else {
                    setUnitPrice(p.sellingPrice.toString());
                    setUnitCost(p.costPrice.toString());
                  }
                }}
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="text-sm font-semibold mb-2 block">Quantity</label>
              <input 
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-2.5 bg-input-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Date */}
            <div>
              <label className="text-sm font-semibold mb-2 block">Date</label>
              <input 
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-input-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Unit Price (for sales) or Unit Cost (for purchases) */}
            <div>
              <label className="text-sm font-semibold mb-2 block">
                {record.type === 'sale' ? 'Selling Price (per unit)' : 'Cost Price (per unit)'}
              </label>
              <input 
                type="number"
                value={record.type === 'sale' ? unitPrice : unitCost}
                onChange={(e) => {
                  if (record.type === 'sale') setUnitPrice(e.target.value);
                  else setUnitCost(e.target.value);
                }}
                className="w-full px-4 py-2.5 bg-input-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Totals Display */}
            <div className="flex items-end pb-1">
              <div className="w-full p-2.5 bg-muted rounded-lg border border-border flex justify-between items-center px-4">
                <span className="text-sm font-medium text-muted-foreground">New Total:</span>
                <span className="text-lg font-bold font-mono">
                  {formatCurrency(record.type === 'sale' ? totalPrice : (parseFloat(quantity) || 0) * (parseFloat(unitCost) || 0))}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div className="col-span-2">
              <label className="text-sm font-semibold mb-2 block">Notes</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 bg-input-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="mt-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border flex gap-3 bg-muted/10">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border hover:bg-muted font-medium transition-colors disabled:opacity-50"
          >
            Discard Changes
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? 'Saving...' : <><Check className="w-4 h-4" /> Update Record</>}
          </button>
        </div>
      </div>
    </div>
  );
}
