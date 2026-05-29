import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, X, Pencil, Trash2, ScanBarcode } from 'lucide-react';
import { getSeries, addSerie, updateSerie, deleteSerie, refreshSeries, subscribeSeries, getSerieBoxQuantity, type Serie, type SerieComponent } from './data/series';
import { getProducts, addProduct, updateProduct, subscribeProducts, type Product } from './data/products';
import { generateBarcodeNumber } from './BarcodeGenerator';
import { ProductPicker } from './ProductPicker';
import { getSuppliers, subscribeSuppliers } from './data/suppliers';
import { SeriesBoxStockManager } from './SeriesBoxStockManager';
import { getErrorMessage, normalizeBarcodeScan } from './data/shared';
import { BarcodeGeneratorModal, BarcodeDisplay } from './BarcodeGenerator';
import { ItemImage, ItemImagePlaceholder } from './ItemImagePlaceholder';

const serieCategories = ['Shoes', 'Shirts', 'Pants', 'Accessories'];

type BoxComponentDraft = SerieComponent & {
  isNew?: boolean;
  newName?: string;
  newCostPrice?: string;
};

type SeriesFormState = {
  name: string;
  boxBarcode: string;
  category: string;
  image: string;
  costPrice: string;
  sellingPrice: string;
  targetBoxes: string;
  supplierId: string;
};

const emptyForm: SeriesFormState = {
  name: '',
  boxBarcode: '',
  category: 'Shoes',
  image: '',
  costPrice: '',
  sellingPrice: '',
  targetBoxes: '',
  supplierId: '',
};

function formatDz(amount: number) {
  return `${amount.toFixed(2)} DZD`;
}

function makeInitialComponents(_products: Product[]): BoxComponentDraft[] {
  return [{ productId: '', quantity: 1, label: '', isNew: false, newName: '', newCostPrice: '' }];
}

function cloneComponents(components: SerieComponent[]) {
  return components.map((component) => ({ ...component }));
}

export function SeriesView() {
  const [series, setSeries] = useState(getSeries);
  const [products, setProducts] = useState(getProducts);
  const [suppliers, setSuppliers] = useState(getSuppliers);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSerie, setEditingSerie] = useState<Serie | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [detailSerie, setDetailSerie] = useState<Serie | null>(null);
  const [form, setForm] = useState<SeriesFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [components, setComponents] = useState<BoxComponentDraft[]>(makeInitialComponents(getProducts()));
  const [showBoxBarcodeGen, setShowBoxBarcodeGen] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const unsubSeries = subscribeSeries(() => setSeries(getSeries()));
    const unsubProducts = subscribeProducts(() => {
      setProducts(getProducts());
      void refreshSeries();
    });
    const unsubSuppliers = subscribeSuppliers(() => setSuppliers(getSuppliers()));
    return () => {
      unsubSeries();
      unsubProducts();
      unsubSuppliers();
    };
  }, []);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const filtered = series.filter((serie) => {
    const q = searchQuery.toLowerCase();
    return serie.name.toLowerCase().includes(q) || serie.boxBarcode.toLowerCase().includes(q);
  });

  const openAdd = () => {
    const defaultComponents = makeInitialComponents(products);
    setForm(emptyForm);
    setComponents(defaultComponents);
    setFormErrors({});
    setEditingSerie(null);
    setSaveError('');
    setShowAddModal(true);
  };

  const openEdit = (serie: Serie) => {
    setForm({
      name: serie.name,
      boxBarcode: serie.boxBarcode,
      category: serie.category,
      image: serie.image,
      costPrice: serie.costPrice > 0 ? serie.costPrice.toString() : '',
      sellingPrice: serie.sellingPrice.toString(),
      targetBoxes: getSerieBoxQuantity(serie).toString(),
      supplierId: serie.supplierId || '',
    });

    let nextComponents: BoxComponentDraft[];
    if (serie.components.length > 0) {
      // Map components — detect box-only products and load them in "new" mode
      nextComponents = serie.components.map((comp) => {
        const product = productMap.get(comp.productId);
        if (product?.boxOnly) {
          // Show as box-only editable row with details pre-filled
          const qty = Math.max(1, Math.trunc(comp.quantity));
          const boxes = product.stock > 0 ? Math.floor(product.stock / qty) : 0;
          return {
            ...comp,
            isNew: true,
            newName: product.name,
            newCostPrice: (comp.unitCost ?? product.costPrice).toString(),
          } as BoxComponentDraft;
        }
        return { ...comp } as BoxComponentDraft;
      });
    } else {
      nextComponents = serie.legacyItems?.map((item) => ({ productId: '', quantity: item.quantity, label: item.size })) ?? makeInitialComponents(products);
    }

    setComponents(nextComponents.length > 0 ? nextComponents : makeInitialComponents(products));
    setFormErrors({});
    setSaveError('');
    setEditingSerie(serie);
    setShowAddModal(true);
  };

  const computedCostPrice = useMemo(() => {
    return components.reduce((sum, component) => {
      if (component.unitCost != null && component.unitCost > 0) {
        return sum + component.unitCost * Math.max(1, Math.trunc(component.quantity));
      }
      if (component.isNew && component.newCostPrice) {
        const cost = parseFloat(component.newCostPrice);
        return sum + (isNaN(cost) ? 0 : cost * Math.max(1, Math.trunc(component.quantity)));
      }
      const product = productMap.get(component.productId);
      return sum + (product ? product.costPrice * Math.max(1, Math.trunc(component.quantity)) : 0);
    }, 0);
  }, [components, productMap]);

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) errors.name = 'Required';
    if (!form.boxBarcode.trim()) errors.boxBarcode = 'Required';
    if (!form.sellingPrice || Number.isNaN(Number(form.sellingPrice)) || Number(form.sellingPrice) <= 0) errors.sellingPrice = 'Invalid';
    if (!form.targetBoxes || Number.isNaN(Number(form.targetBoxes)) || Number(form.targetBoxes) < 0) errors.targetBoxes = 'Invalid';
    if (components.length === 0) errors.components = 'Add at least one product';

    for (const component of components) {
      if (component.isNew) {
        if (!component.newName?.trim()) {
          errors.components = 'Enter a name for each new product';
          break;
        }
        if (!component.newCostPrice || isNaN(Number(component.newCostPrice)) || Number(component.newCostPrice) <= 0) {
          errors.components = 'Enter a valid unit cost price for each new product';
          break;
        }
      } else {
        if (!component.productId) {
          errors.components = 'Select a product for each component';
          break;
        }
      }
    }

    // Check for duplicate existing products (skip new ones)
    const selectedProducts = components.filter((c) => !c.isNew).map((c) => c.productId).filter(Boolean);
    if (new Set(selectedProducts).size !== selectedProducts.length) {
      errors.components = 'Do not repeat the same product more than once';
    }

    if (components.some((component) => Number.isNaN(Number(component.quantity)) || Number(component.quantity) <= 0)) {
      errors.components = 'Every component quantity must be at least 1';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!validate()) return;
    setSaveError('');
    setIsSaving(true);

    try {
      // First, create any new box-only products
      const resolvedComponents: { productId: string; quantity: number; label?: string; unitCost?: number }[] = [];

      const targetBoxes = Math.max(0, Math.trunc(Number(form.targetBoxes)) || 0);

      for (const component of components) {
        const qty = Math.max(1, Math.trunc(Number(component.quantity)) || 1);
        const requiredStock = targetBoxes * qty;

        if (component.isNew) {
          const costPrice = parseFloat(component.newCostPrice || '0');

          let productId: string;
          let productName: string;

          if (component.productId) {
            // Existing box-only product — update it
            const existingProduct = productMap.get(component.productId);
            if (existingProduct) {
              await updateProduct({
                ...existingProduct,
                name: component.newName?.trim() || existingProduct.name,
                costPrice,
                stock: requiredStock,
              });
            }
            productId = component.productId;
            productName = component.newName?.trim() || existingProduct?.name || 'Unnamed Product';
          } else {
            // Brand new box-only product — create it
            const newProduct = await addProduct({
              name: component.newName?.trim() || 'Unnamed Product',
              price: 0,
              costPrice,
              category: form.category,
              image: '',
              barcode: generateBarcodeNumber(),
              sku: `SKU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
              variants: '-',
              stock: requiredStock,
              boxOnly: true,
            });
            productId = newProduct.id;
            productName = newProduct.name;
          }

          resolvedComponents.push({
            productId,
            quantity: qty,
            label: productName,
            unitCost: costPrice,
          });
        } else {
          // Update stock for existing normal product to match requested boxes
          const product = productMap.get(component.productId);
          if (product && product.stock !== requiredStock) {
            await updateProduct({ ...product, stock: requiredStock });
          }

          const effectiveCost = (component.unitCost != null && component.unitCost > 0)
            ? component.unitCost
            : product?.costPrice;
          resolvedComponents.push({
            productId: component.productId,
            quantity: qty,
            label: component.label,
            unitCost: effectiveCost,
          });
        }
      }

      const data = {
        name: form.name.trim(),
        boxBarcode: form.boxBarcode.trim(),
        category: form.category,
        image: form.image,
        costPrice: form.costPrice ? parseFloat(form.costPrice) : computedCostPrice,
        sellingPrice: parseFloat(form.sellingPrice),
        supplierId: form.supplierId || undefined,
        components: resolvedComponents,
      };

      if (editingSerie) {
        await updateSerie({ ...editingSerie, ...data, components: data.components, legacyItems: undefined });
      } else {
        await addSerie(data);
      }
      setShowAddModal(false);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
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

  const addComponent = () => {
    setComponents((prev) => [
      ...prev,
      {
        productId: '',
        quantity: 1,
        label: '',
        isNew: false,
        newName: '',
        newCostPrice: '',
      },
    ]);
  };

  const removeComponent = (index: number) => {
    setComponents((prev) => (prev.length === 1 ? prev : prev.filter((_, current) => current !== index)));
  };

  const updateComponent = (index: number, patch: Partial<BoxComponentDraft>) => {
    setComponents((prev) => prev.map((component, current) => (current === index ? { ...component, ...patch } : component)));
  };

  const supplierName = (id?: string) => {
    if (!id) return '—';
    const supplier = suppliers.find((entry) => entry.id === id);
    return supplier ? supplier.name : '—';
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1>Boxes</h1>
          <p className="text-muted-foreground mt-1">Define box templates from inventory products</p>
        </div>
        <button onClick={openAdd} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2">
          <Plus className="w-5 h-5" /> Add New Box
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
          <input
            type="text"
            placeholder="Search boxes..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-input-background border border-border rounded-lg"
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Image</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Name</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Box Barcode</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Category</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Components</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Available</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Cost</th>
              <th className="px-6 py-3 text-left text-sm text-muted-foreground">Price</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((serie) => {
              const available = getSerieBoxQuantity(serie);
              const componentSummary = serie.components.length > 0
                ? serie.components.map((component) => {
                    const product = productMap.get(component.productId);
                    const name = product?.name || component.label || component.productId;
                    const badge = product?.boxOnly ? ' 📦' : '';
                    return `${name}${badge} ×${component.quantity}`;
                  }).join(', ')
                : 'Needs setup';

              return (
                <tr key={serie.id} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => setDetailSerie(serie)}>
                  <td className="px-6 py-4">
                    <ItemImage
                      src={serie.image}
                      alt={serie.name}
                      category={serie.category}
                      className="w-12 h-12"
                      iconClassName="w-5 h-5"
                    />
                  </td>
                  <td className="px-6 py-4 font-medium">{serie.name}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-sm">{serie.boxBarcode}</td>
                  <td className="px-6 py-4 text-muted-foreground">{serie.category}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground max-w-[340px] truncate">{componentSummary}</td>
                  <td className="px-6 py-4 text-sm">{available}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDz(serie.costPrice)}</td>
                  <td className="px-6 py-4">{formatDz(serie.sellingPrice)}</td>
                  <td className="px-6 py-4" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(serie)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteConfirmId(serie.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">No boxes found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-4xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2>{editingSerie ? 'Edit Box' : 'Add New Box'}</h2>
                <p className="text-sm text-muted-foreground mt-1">Build the default package from inventory products.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-5 max-h-[76vh] overflow-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Box Name *</label>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.name ? 'border-red-400' : 'border-border'}`}
                    placeholder="e.g. Nike Air Max Box"
                  />
                  {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Category *</label>
                  <select
                    value={form.category}
                    onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                    className="w-full px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm"
                  >
                    {serieCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Box Barcode *</label>
                  <div className="flex gap-2">
                    <input
                      value={form.boxBarcode}
                      onChange={(event) => setForm((prev) => ({ ...prev, boxBarcode: normalizeBarcodeScan(event.target.value) }))}
                      className={`flex-1 px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.boxBarcode ? 'border-red-400' : 'border-border'}`}
                      placeholder="Scan or type box barcode"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBoxBarcodeGen(true)}
                      className="px-3 py-2.5 bg-primary/10 text-primary border border-primary/30 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1.5 text-sm whitespace-nowrap"
                    >
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
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Cost Price *</label>
                  <input
                    value={form.costPrice}
                    onChange={(event) => setForm((prev) => ({ ...prev, costPrice: event.target.value }))}
                    type="number"
                    step="0.01"
                    min="0"
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.costPrice ? 'border-red-400' : 'border-border'}`}
                    placeholder={computedCostPrice > 0 ? computedCostPrice.toFixed(2) : '0.00'}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {computedCostPrice > 0 ? `Auto-calculated: ${formatDz(computedCostPrice)}` : 'Currency: DZD'}
                  </p>
                  {formErrors.costPrice && <p className="text-red-500 text-xs mt-1">{formErrors.costPrice}</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Selling Price *</label>
                  <input
                    value={form.sellingPrice}
                    onChange={(event) => setForm((prev) => ({ ...prev, sellingPrice: event.target.value }))}
                    type="number"
                    step="0.01"
                    min="0"
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.sellingPrice ? 'border-red-400' : 'border-border'}`}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Currency: DZD</p>
                  {formErrors.sellingPrice && <p className="text-red-500 text-xs mt-1">{formErrors.sellingPrice}</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Available Boxes *</label>
                  <input
                    value={form.targetBoxes}
                    onChange={(event) => setForm((prev) => ({ ...prev, targetBoxes: event.target.value }))}
                    type="number"
                    min="0"
                    step="1"
                    className={`w-full px-3 py-2.5 bg-input-background border rounded-lg text-sm ${formErrors.targetBoxes ? 'border-red-400' : 'border-border'}`}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Updates inventory automatically</p>
                  {formErrors.targetBoxes && <p className="text-red-500 text-xs mt-1">{formErrors.targetBoxes}</p>}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-sm text-muted-foreground block">Components *</label>
                    <p className="text-xs text-muted-foreground">Pick existing products or add new box-only products.</p>
                  </div>
                  <button type="button" onClick={addComponent} className="px-3 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg hover:bg-primary/20 text-sm">
                    <Plus className="inline w-4 h-4 mr-1" /> Add Product
                  </button>
                </div>

                <div className="space-y-3">
                  {components.map((component, index) => {
                    const product = productMap.get(component.productId);
                    const isNewMode = !!component.isNew;
                    const effectiveUnitCost = isNewMode
                      ? parseFloat(component.newCostPrice || '0') || 0
                      : (component.unitCost != null && component.unitCost > 0)
                        ? component.unitCost
                        : product?.costPrice ?? 0;

                    return (
                      <div key={`${index}-${component.productId || 'new'}`} className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                        {/* Toggle: Existing vs New */}
                        <div className="flex items-center gap-3">
                          <div className="flex bg-muted rounded-lg p-0.5 text-sm">
                            <button
                              type="button"
                              onClick={() => updateComponent(index, { isNew: false, newName: '', newCostPrice: '' })}
                              className={`px-3 py-1.5 rounded-md transition-colors ${!isNewMode ? 'bg-card shadow-sm text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                              Existing Product
                            </button>
                            <button
                              type="button"
                              onClick={() => updateComponent(index, { isNew: true, productId: '', label: '' })}
                              className={`px-3 py-1.5 rounded-md transition-colors ${isNewMode ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                              New Box-Only Product
                            </button>
                          </div>
                          <div className="flex-1" />
                          <button type="button" onClick={() => removeComponent(index)} className="text-muted-foreground hover:text-red-500 px-2">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {isNewMode ? (
                          /* New box-only product fields */
                          <div className="grid grid-cols-[1fr_120px_100px] gap-2 items-start">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Product Name *</label>
                              <input
                                value={component.newName || ''}
                                onChange={(event) => updateComponent(index, { newName: event.target.value })}
                                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
                                placeholder="e.g. Size 42 Black"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Unit Cost *</label>
                              <input
                                value={component.newCostPrice || ''}
                                onChange={(event) => updateComponent(index, { newCostPrice: event.target.value })}
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm text-center"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
                              <input
                                value={component.quantity}
                                onChange={(event) => updateComponent(index, { quantity: Math.max(1, Math.trunc(Number(event.target.value)) || 1) })}
                                type="number"
                                min="1"
                                step="1"
                                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm text-center"
                                placeholder="Qty"
                              />
                            </div>
                            <div className="col-span-3 text-xs text-muted-foreground pl-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                                📦 Will be created as box-only product
                              </span>
                              {effectiveUnitCost > 0 && (
                                <span className="ml-2">Line cost: {formatDz(effectiveUnitCost * Math.max(1, Math.trunc(component.quantity)))}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* Existing product fields */
                          <div className="grid grid-cols-[1fr_120px_100px] gap-2 items-start">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Product</label>
                              <ProductPicker
                                products={products}
                                selectedProductId={component.productId}
                                onSelect={(selectedProduct) => {
                                  updateComponent(index, {
                                    productId: selectedProduct.id,
                                    label: selectedProduct.name,
                                    unitCost: selectedProduct.costPrice,
                                  });
                                }}
                              />
                              {component.label && !component.productId && <p className="mt-1 text-xs text-muted-foreground">Legacy label: {component.label}</p>}
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Unit Cost</label>
                              <input
                                value={component.unitCost != null && component.unitCost > 0 ? component.unitCost : product?.costPrice ?? ''}
                                onChange={(event) => {
                                  const val = parseFloat(event.target.value);
                                  updateComponent(index, { unitCost: isNaN(val) ? 0 : val });
                                }}
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm text-center"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
                              <input
                                value={component.quantity}
                                onChange={(event) => updateComponent(index, { quantity: Math.max(1, Math.trunc(Number(event.target.value)) || 1) })}
                                type="number"
                                min="1"
                                step="1"
                                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm text-center"
                                placeholder="Qty"
                              />
                            </div>
                            <div className="col-span-3 text-xs text-muted-foreground flex flex-wrap gap-3 pl-1">
                              <span>{product ? `Stock: ${product.stock}` : 'No product selected'}</span>
                              {effectiveUnitCost > 0 && (
                                <span>Line cost: {formatDz(effectiveUnitCost * Math.max(1, Math.trunc(component.quantity)))}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {formErrors.components && <p className="text-red-500 text-xs mt-1">{formErrors.components}</p>}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Image</label>
                <div
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (event) => {
                      const file = (event.target as HTMLInputElement).files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (loadEvent) => setForm((prev) => ({ ...prev, image: String(loadEvent.target?.result ?? '') }));
                      reader.readAsDataURL(file);
                    };
                    input.click();
                  }}
                  className="border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
                >
                  {form.image ? (
                    <div className="flex items-center gap-4">
                      <ItemImage src={form.image} alt="Preview" category={form.category} className="w-20 h-20 rounded-lg bg-muted flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm mb-1">Image uploaded</p>
                        <p className="text-xs text-muted-foreground">Click to change</p>
                      </div>
                      <button type="button" onClick={(event) => { event.stopPropagation(); setForm((prev) => ({ ...prev, image: '' })); }} className="text-muted-foreground hover:text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-2 text-muted-foreground">
                      <ItemImagePlaceholder category={form.category} className="w-20 h-20 bg-muted flex-shrink-0" iconClassName="w-8 h-8" />
                      <p className="text-sm">Click to upload image</p>
                      <p className="text-xs">PNG, JPG up to 5MB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {saveError && <div className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}

            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowAddModal(false)} disabled={isSaving} className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={() => void handleSave()} disabled={isSaving} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                {isSaving ? 'Saving...' : editingSerie ? 'Save Changes' : 'Add Box'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="mb-2">Delete Box</h2>
            <p className="text-sm text-muted-foreground mb-6">Are you sure? This will remove the box template.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => void handleDelete(deleteConfirmId)} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {detailSerie && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2>Box Details</h2>
              <button onClick={() => setDetailSerie(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex gap-4">
                <ItemImage src={detailSerie.image} alt={detailSerie.name} category={detailSerie.category} className="w-20 h-20" iconClassName="w-7 h-7" />
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
                  <div className="text-muted-foreground mb-0.5">Available Boxes</div>
                  <div>{getSerieBoxQuantity(detailSerie)}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-muted-foreground mb-0.5">Cost</div>
                  <div>{formatDz(detailSerie.costPrice)}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-muted-foreground mb-0.5">Price</div>
                  <div>{formatDz(detailSerie.sellingPrice)}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-2">Components</div>
                <div className="space-y-2">
                  {detailSerie.components.map((component, index) => {
                    const product = productMap.get(component.productId);
                    return (
                      <div key={`${component.productId}-${index}`} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{product?.name || component.label || component.productId}</span>
                            {product?.boxOnly && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                                📦 Box Only
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{product?.sku || component.label || 'Inventory product'}</div>
                        </div>
                        <div className="text-muted-foreground">×{component.quantity}</div>
                      </div>
                    );
                  })}
                  {detailSerie.legacyItems && detailSerie.legacyItems.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      This box still has legacy size data and should be reconfigured.
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-border">
              <button onClick={() => setDetailSerie(null)} className="w-full py-2.5 border border-border rounded-lg hover:bg-muted transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {showBoxBarcodeGen && (
        <BarcodeGeneratorModal
          initialValue={form.boxBarcode || undefined}
          productName={form.name ? `${form.name} (Box)` : undefined}
          onApply={(barcode) => {
            setForm((prev) => ({ ...prev, boxBarcode: barcode }));
            setShowBoxBarcodeGen(false);
          }}
          onClose={() => setShowBoxBarcodeGen(false)}
        />
      )}
    </div>
  );
}
