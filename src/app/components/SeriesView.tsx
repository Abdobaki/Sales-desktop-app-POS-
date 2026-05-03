import { useState, useEffect } from 'react';
import { Search, Plus, X, Pencil, Trash2, Package, ChevronDown, Upload, ScanBarcode } from 'lucide-react';
import { getSeries, addSerie, updateSerie, deleteSerie, subscribeSeries, getSerieRemainingCount, getSerieTotalCount, getSerieAvailableSizes, type Serie, type SerieItem } from './data/series';
import { getSuppliers, subscribeSuppliers } from './data/suppliers';
import { getErrorMessage } from './data/shared';
import { BarcodeGeneratorModal, BarcodeDisplay, generateBarcodeNumber } from './BarcodeGenerator';

const serieCategories = ['Shoes', 'Shirts', 'Pants', 'Accessories'];

const sizePresets: Record<string, string[]> = {
  'Shoes (39-44)': ['39','40','41','42','43','44'],
  'Shoes (36-41)': ['36','37','38','39','40','41'],
  'Clothing (S-XXL)': ['S','M','L','XL','XXL'],
  'Clothing (XS-XL)': ['XS','S','M','L','XL'],
};

const emptyForm = {
  name: '', boxBarcode: '', productBarcode: '', category: 'Shoes',
  image: '', costPrice: '', sellingPrice: '', unitPrice: '', boxQuantity: '1', supplierId: '',
};

function formatDz(amount: number) {
  return `${amount.toFixed(2)} DZ`;
}

export function SeriesView() {
  const [series, setSeries] = useState(getSeries);
  const [suppliers, setSuppliers] = useState(getSuppliers);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSerie, setEditingSerie] = useState<Serie | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [detailSerie, setDetailSerie] = useState<Serie | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [sizes, setSizes] = useState<{size: string; quantity: number}[]>([]);
  const [newSize, setNewSize] = useState('');
  const [newSizeQty, setNewSizeQty] = useState('1');
  const [showBoxBarcodeGen, setShowBoxBarcodeGen] = useState(false);
  const [showProductBarcodeGen, setShowProductBarcodeGen] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const u1 = subscribeSeries(() => setSeries(getSeries()));
    const u2 = subscribeSuppliers(() => setSuppliers(getSuppliers()));
    return () => { u1(); u2(); };
  }, []);

  const filtered = series.filter((s) => {
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.boxBarcode.includes(searchQuery) || s.productBarcode.includes(searchQuery);
  });

  const openAdd = () => {
    setForm(emptyForm); setFormErrors({}); setSizes([]); setEditingSerie(null); setSaveError(''); setShowAddModal(true);
  };

  const openEdit = (s: Serie) => {
    setForm({
      name: s.name, boxBarcode: s.boxBarcode, productBarcode: s.productBarcode,
      category: s.category, image: s.image, costPrice: s.costPrice.toString(),
      sellingPrice: s.sellingPrice.toString(), unitPrice: s.unitPrice.toString(), boxQuantity: s.boxQuantity.toString(), supplierId: s.supplierId || '',
    });
    setSizes(s.items.map(i => ({ size: i.size, quantity: i.quantity })));
    setFormErrors({}); setSaveError(''); setEditingSerie(s); setShowAddModal(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.boxBarcode.trim()) e.boxBarcode = 'Required';
    if (!form.productBarcode.trim()) e.productBarcode = 'Required';
    if (!form.costPrice || isNaN(Number(form.costPrice)) || Number(form.costPrice) <= 0) e.costPrice = 'Invalid';
    if (!form.sellingPrice || isNaN(Number(form.sellingPrice)) || Number(form.sellingPrice) <= 0) e.sellingPrice = 'Invalid';
    if (!form.unitPrice || isNaN(Number(form.unitPrice)) || Number(form.unitPrice) <= 0) e.unitPrice = 'Invalid';
    if (form.boxQuantity === '' || isNaN(Number(form.boxQuantity)) || Number(form.boxQuantity) < 0 || !Number.isInteger(Number(form.boxQuantity))) e.boxQuantity = 'Invalid';
    if (sizes.length === 0) e.sizes = 'Add at least one size';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaveError('');

    const data = {
      name: form.name.trim(), boxBarcode: form.boxBarcode.trim(),
      productBarcode: form.productBarcode.trim(), category: form.category,
      image: form.image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
      costPrice: parseFloat(form.costPrice), sellingPrice: parseFloat(form.sellingPrice),
      unitPrice: parseFloat(form.unitPrice),
      boxQuantity: Math.trunc(Number(form.boxQuantity)),
      supplierId: form.supplierId || undefined,
      items: sizes.map(s => ({ size: s.size, quantity: s.quantity, sold: 0 } as SerieItem)),
    };

    try {
      if (editingSerie) {
        const existingItems = editingSerie.items;
        const items = sizes.map(s => {
          const existing = existingItems.find(i => i.size === s.size);
          return { size: s.size, quantity: s.quantity, sold: existing ? Math.min(existing.sold, s.quantity) : 0 };
        });
        await updateSerie({ ...editingSerie, ...data, items });
      } else {
        await addSerie(data);
      }
      setShowAddModal(false);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSerie(id);
      setDeleteConfirmId(null);
    } catch (error) {
      setSaveError(getErrorMessage(error));
      setDeleteConfirmId(null);
    }
  };

  const addSize = () => {
    const s = newSize.trim();
    const q = parseInt(newSizeQty) || 1;
    if (s && !sizes.find(x => x.size === s)) {
      setSizes([...sizes, { size: s, quantity: q }]);
      setNewSize(''); setNewSizeQty('1');
      if (formErrors.sizes) setFormErrors(p => { const n = {...p}; delete n.sizes; return n; });
    }
  };

  const removeSize = (idx: number) => setSizes(sizes.filter((_, i) => i !== idx));

  const updateSizeQty = (idx: number, qty: number) => {
    setSizes(sizes.map((s, i) => i === idx ? { ...s, quantity: Math.max(1, qty) } : s));
  };

  const applyPreset = (key: string) => {
    const preset = sizePresets[key];
    if (preset) {
      setSizes(preset.map(s => ({ size: s, quantity: 1 })));
      if (formErrors.sizes) setFormErrors(p => { const n = {...p}; delete n.sizes; return n; });
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(p => ({ ...p, [field]: value }));
    if (formErrors[field]) setFormErrors(p => { const n = {...p}; delete n[field]; return n; });
  };

  const supplierName = (id?: string) => {
    if (!id) return '—';
    const s = suppliers.find(s => s.id === id);
    return s ? s.name : '—';
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1>Series</h1>
          <p className="text-muted-foreground mt-1">Manage product boxes & sets</p>
        </div>
        <button onClick={openAdd} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2">
          <Plus className="w-5 h-5" /> Add New Serie
        </button>
      </div>

      {saveError && !showAddModal && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
          <input type="text" placeholder="Search series..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-input-background border border-border rounded-lg" />
        </div>
      </div>

      {/* Series Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Image</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Name</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Box Barcode</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Product Barcode</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Box Qty</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Category</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Sizes</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Sizes Remaining</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Box Cost</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Box Price</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const rem = getSerieRemainingCount(s);
              const tot = getSerieTotalCount(s);
              return (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => setDetailSerie(s)}>
                  <td className="px-6 py-4">
                    <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden">
                      <img src={s.image} alt={s.name} className="w-full h-full object-cover" />
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium">{s.name}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-sm">{s.boxBarcode}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-sm">{s.productBarcode}</td>
                  <td className="px-6 py-4 text-sm">{s.boxQuantity}</td>
                  <td className="px-6 py-4 text-muted-foreground">{s.category}</td>
                  <td className="px-6 py-4 text-sm">{s.items.map(i => `${i.size}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(', ')}</td>
                  <td className="px-6 py-4">
                    <span className={rem <= 2 ? 'text-red-600' : rem < tot ? 'text-amber-600' : ''}>{rem}/{tot}</span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDz(s.costPrice)}</td>
                  <td className="px-6 py-4">{formatDz(s.sellingPrice)}</td>
                  <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteConfirmId(s.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="px-6 py-12 text-center text-muted-foreground">No series found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2>{editingSerie ? 'Edit Serie' : 'Add New Serie'}</h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-auto">
              {/* Name + Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Serie Name *</label>
                  <input value={form.name} onChange={e => updateField('name', e.target.value)}
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.name ? 'border-red-400' : 'border-border'}`}
                    placeholder="e.g. Nike Air Max Serie" />
                  {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Category *</label>
                  <select value={form.category} onChange={e => updateField('category', e.target.value)}
                    className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm">
                    {serieCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {/* Barcodes */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Box Barcode *</label>
                  <div className="flex gap-2">
                    <input value={form.boxBarcode} onChange={e => updateField('boxBarcode', e.target.value)}
                      className={`flex-1 px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.boxBarcode ? 'border-red-400' : 'border-border'}`}
                      placeholder="Scan or type box barcode" />
                    <button type="button" onClick={() => setShowBoxBarcodeGen(true)}
                      className="px-3 py-2.5 bg-primary/10 text-primary border border-primary/30 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1.5 text-sm whitespace-nowrap">
                      <ScanBarcode className="w-4 h-4" /> Generate
                    </button>
                  </div>
                  {formErrors.boxBarcode && <p className="text-red-500 text-xs mt-1">{formErrors.boxBarcode}</p>}
                  {form.boxBarcode && (
                    <div className="mt-2 bg-white border border-border rounded-lg p-2 flex justify-center">
                      <BarcodeDisplay value={form.boxBarcode} width={1.5} height={40} />
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Product Barcode *</label>
                  <div className="flex gap-2">
                    <input value={form.productBarcode} onChange={e => updateField('productBarcode', e.target.value)}
                      className={`flex-1 px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.productBarcode ? 'border-red-400' : 'border-border'}`}
                      placeholder="Scan or type product barcode" />
                    <button type="button" onClick={() => setShowProductBarcodeGen(true)}
                      className="px-3 py-2.5 bg-primary/10 text-primary border border-primary/30 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1.5 text-sm whitespace-nowrap">
                      <ScanBarcode className="w-4 h-4" /> Generate
                    </button>
                  </div>
                  {formErrors.productBarcode && <p className="text-red-500 text-xs mt-1">{formErrors.productBarcode}</p>}
                  {form.productBarcode && (
                    <div className="mt-2 bg-white border border-border rounded-lg p-2 flex justify-center">
                      <BarcodeDisplay value={form.productBarcode} width={1.5} height={40} />
                    </div>
                  )}
                </div>
              </div>
              {/* Prices */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Box Cost Price *</label>
                  <input value={form.costPrice} onChange={e => updateField('costPrice', e.target.value)} type="number" step="0.01" min="0"
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.costPrice ? 'border-red-400' : 'border-border'}`} placeholder="0.00" />
                  <p className="text-xs text-muted-foreground mt-1">Currency: DZ</p>
                  {formErrors.costPrice && <p className="text-red-500 text-xs mt-1">{formErrors.costPrice}</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Box Selling Price *</label>
                  <input value={form.sellingPrice} onChange={e => updateField('sellingPrice', e.target.value)} type="number" step="0.01" min="0"
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.sellingPrice ? 'border-red-400' : 'border-border'}`} placeholder="0.00" />
                  <p className="text-xs text-muted-foreground mt-1">Currency: DZ</p>
                  {formErrors.sellingPrice && <p className="text-red-500 text-xs mt-1">{formErrors.sellingPrice}</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Unit Price *</label>
                  <input value={form.unitPrice} onChange={e => updateField('unitPrice', e.target.value)} type="number" step="0.01" min="0"
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.unitPrice ? 'border-red-400' : 'border-border'}`} placeholder="0.00" />
                  <p className="text-xs text-muted-foreground mt-1">Currency: DZ</p>
                  {formErrors.unitPrice && <p className="text-red-500 text-xs mt-1">{formErrors.unitPrice}</p>}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Box Quantity *</label>
                <input
                  value={form.boxQuantity}
                  onChange={e => updateField('boxQuantity', e.target.value)}
                  type="number"
                  min="0"
                  step="1"
                  className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.boxQuantity ? 'border-red-400' : 'border-border'}`}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground mt-1">How many boxes of this serie are in stock</p>
                {formErrors.boxQuantity && <p className="text-red-500 text-xs mt-1">{formErrors.boxQuantity}</p>}
              </div>
              {Number(form.costPrice) > 0 && Number(form.sellingPrice) > 0 && (
                <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Box profit</span>
                  <span className={`text-sm ${Number(form.sellingPrice) - Number(form.costPrice) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatDz(Number(form.sellingPrice) - Number(form.costPrice))}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({((Number(form.sellingPrice) - Number(form.costPrice)) / Number(form.costPrice) * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
              )}
              {/* Sizes with Quantity */}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Sizes & Quantities *</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Object.keys(sizePresets).map(k => (
                    <button key={k} type="button" onClick={() => applyPreset(k)}
                      className="px-2.5 py-1 text-xs border border-border rounded-full hover:bg-primary/10 hover:border-primary/30 transition-colors">{k}</button>
                  ))}
                </div>
                <div className="flex gap-2 mb-2">
                  <input value={newSize} onChange={e => setNewSize(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSize(); } }}
                    className="flex-1 px-3 py-2 bg-input-background border border-border rounded-lg text-sm" placeholder="Size (e.g. 42)" />
                  <input value={newSizeQty} onChange={e => setNewSizeQty(e.target.value)} type="number" min="1"
                    className="w-16 px-3 py-2 bg-input-background border border-border rounded-lg text-sm text-center" placeholder="Qty" />
                  <button type="button" onClick={addSize} className="px-3 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg hover:bg-primary/20 text-sm">Add</button>
                </div>
                {sizes.length > 0 && (
                  <div className="space-y-1.5">
                    {sizes.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-lg">
                        <span className="text-sm text-primary font-medium min-w-[40px]">{s.size}</span>
                        <span className="text-xs text-muted-foreground">×</span>
                        <input type="number" min="1" value={s.quantity} onChange={e => updateSizeQty(i, parseInt(e.target.value) || 1)}
                          className="w-14 px-2 py-1 bg-input-background border border-border rounded text-sm text-center" />
                        <span className="text-xs text-muted-foreground flex-1">units</span>
                        <button type="button" onClick={() => removeSize(i)} className="text-muted-foreground hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                    <div className="text-xs text-muted-foreground mt-1">Total items: {sizes.reduce((s, x) => s + x.quantity, 0)}</div>
                  </div>
                )}
                {formErrors.sizes && <p className="text-red-500 text-xs mt-1">{formErrors.sizes}</p>}
              </div>
              {/* Supplier */}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Supplier (Optional)</label>
                <select value={form.supplierId} onChange={e => updateField('supplierId', e.target.value)}
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm">
                  <option value="">No Supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.company ? ` (${s.company})` : ''}</option>)}
                </select>
              </div>
              {/* Image Upload */}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Serie Image</label>
                <div
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => { updateField('image', ev.target?.result as string); };
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}
                  className="border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
                >
                  {form.image ? (
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm mb-1">Image uploaded</p>
                        <p className="text-xs text-muted-foreground">Click to change</p>
                      </div>
                      <button type="button" onClick={(e) => { e.stopPropagation(); updateField('image', ''); }}
                        className="text-muted-foreground hover:text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-2 text-muted-foreground">
                      <Upload className="w-8 h-8 opacity-40" />
                      <p className="text-sm">Click to upload image</p>
                      <p className="text-xs">PNG, JPG up to 5MB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {saveError && <div className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => void handleSave()} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                {editingSerie ? 'Save Changes' : 'Add Serie'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="mb-2">Delete Serie</h2>
            <p className="text-sm text-muted-foreground mb-6">Are you sure? This will remove the entire box and all its items.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
               <button onClick={() => void handleDelete(deleteConfirmId)} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Serie Detail Modal */}
      {detailSerie && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2>Serie Details</h2>
              <button onClick={() => setDetailSerie(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                  <img src={detailSerie.image} alt={detailSerie.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="font-medium">{detailSerie.name}</h3>
                  <p className="text-sm text-muted-foreground">{detailSerie.category}</p>
                  <p className="text-sm text-muted-foreground mt-1">Supplier: {supplierName(detailSerie.supplierId)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-muted-foreground mb-0.5">Box Barcode</div>
                  <div className="font-mono">{detailSerie.boxBarcode}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-muted-foreground mb-0.5">Product Barcode</div>
                  <div className="font-mono">{detailSerie.productBarcode}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-muted-foreground mb-0.5">Box Qty</div>
                  <div>{detailSerie.boxQuantity}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-muted-foreground mb-0.5">Box Cost</div>
                  <div>{formatDz(detailSerie.costPrice)}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-muted-foreground mb-0.5">Box Price</div>
                  <div>{formatDz(detailSerie.sellingPrice)}</div>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">Items ({getSerieRemainingCount(detailSerie)}/{getSerieTotalCount(detailSerie)} remaining)</div>
                <div className="flex flex-wrap gap-2">
                  {detailSerie.items.map((item, i) => {
                    const remaining = item.quantity - item.sold;
                    const allSold = remaining === 0;
                    return (
                      <span key={i} className={`px-3 py-1.5 rounded-full text-sm ${allSold ? 'bg-red-100 text-red-600 line-through' : remaining < item.quantity ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {item.size} {item.quantity > 1 ? `(${remaining}/${item.quantity})` : allSold ? '(Sold)' : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-border">
              <button onClick={() => setDetailSerie(null)} className="w-full py-2.5 border border-border rounded-lg hover:bg-muted transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
      {/* Barcode Generator Modals */}
      {showBoxBarcodeGen && (
        <BarcodeGeneratorModal
          initialValue={form.boxBarcode || undefined}
          productName={form.name ? `${form.name} (Box)` : undefined}
          onApply={(barcode) => { updateField('boxBarcode', barcode); setShowBoxBarcodeGen(false); }}
          onClose={() => setShowBoxBarcodeGen(false)}
        />
      )}
      {showProductBarcodeGen && (
        <BarcodeGeneratorModal
          initialValue={form.productBarcode || undefined}
          productName={form.name ? `${form.name} (Product)` : undefined}
          onApply={(barcode) => { updateField('productBarcode', barcode); setShowProductBarcodeGen(false); }}
          onClose={() => setShowProductBarcodeGen(false)}
        />
      )}
    </div>
  );
}
