import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, X, Pencil, Trash2, ScanBarcode } from 'lucide-react';
import { getSeries, addSerie, updateSerie, deleteSerie, refreshSeries, subscribeSeries, getSerieBoxQuantity, type Serie, type SerieComponent } from './data/series';
import { getProducts, subscribeProducts, type Product } from './data/products';
import { ProductPicker } from './ProductPicker';
import { getSuppliers, subscribeSuppliers } from './data/suppliers';
import { getErrorMessage } from './data/shared';
import { BarcodeGeneratorModal, BarcodeDisplay } from './BarcodeGenerator';
import { ItemImage, ItemImagePlaceholder } from './ItemImagePlaceholder';

const serieCategories = ['Shoes', 'Shirts', 'Pants', 'Accessories'];

type BoxComponentDraft = SerieComponent;

type SeriesFormState = {
  name: string;
  boxBarcode: string;
  category: string;
  image: string;
  sellingPrice: string;
  supplierId: string;
};

const emptyForm: SeriesFormState = {
  name: '',
  boxBarcode: '',
  category: 'Shoes',
  image: '',
  sellingPrice: '',
  supplierId: '',
};

function formatDz(amount: number) {
  return `${amount.toFixed(2)} DZ`;
}

function makeInitialComponents(products: Product[]) {
  const firstProduct = products[0];
  return [{ productId: firstProduct?.id ?? '', quantity: 1, label: firstProduct?.name }];
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
      sellingPrice: serie.sellingPrice.toString(),
      supplierId: serie.supplierId || '',
    });

    const nextComponents = serie.components.length > 0
      ? cloneComponents(serie.components)
      : (serie.legacyItems?.map((item) => ({ productId: '', quantity: item.quantity, label: item.size })) ?? makeInitialComponents(products));

    setComponents(nextComponents.length > 0 ? nextComponents : makeInitialComponents(products));
    setFormErrors({});
    setSaveError('');
    setEditingSerie(serie);
    setShowAddModal(true);
  };

  const computedCostPrice = useMemo(() => {
    return components.reduce((sum, component) => {
      const product = productMap.get(component.productId);
      return sum + (product ? product.costPrice * Math.max(1, Math.trunc(component.quantity)) : 0);
    }, 0);
  }, [components, productMap]);

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) errors.name = 'Required';
    if (!form.boxBarcode.trim()) errors.boxBarcode = 'Required';
    if (!form.sellingPrice || Number.isNaN(Number(form.sellingPrice)) || Number(form.sellingPrice) <= 0) errors.sellingPrice = 'Invalid';
    if (components.length === 0) errors.components = 'Add at least one product';

    if (components.some((component) => !component.productId)) {
      errors.components = 'Select a product for each component';
    }

    const selectedProducts = components.map((component) => component.productId).filter(Boolean);
    if (new Set(selectedProducts).size !== selectedProducts.length) {
      errors.components = 'Do not repeat the same product more than once';
    }

    if (components.some((component) => Number.isNaN(Number(component.quantity)) || Number(component.quantity) <= 0)) {
      errors.components = 'Every component quantity must be at least 1';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaveError('');

    const data = {
      name: form.name.trim(),
      boxBarcode: form.boxBarcode.trim(),
      category: form.category,
      image: form.image,
      costPrice: computedCostPrice,
      sellingPrice: parseFloat(form.sellingPrice),
      supplierId: form.supplierId || undefined,
      components: components.map((component) => ({
        productId: component.productId,
        quantity: Math.max(1, Math.trunc(Number(component.quantity)) || 1),
        label: component.label,
      })),
    };

    try {
      if (editingSerie) {
        await updateSerie({ ...editingSerie, ...data, components: data.components, legacyItems: undefined });
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

  const addComponent = () => {
    const defaultProduct = products.find((product) => !components.some((component) => component.productId === product.id)) ?? products[0];
    setComponents((prev) => [
      ...prev,
      {
        productId: defaultProduct?.id ?? '',
        quantity: 1,
        label: defaultProduct?.name,
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
                    return `${product?.name || component.label || component.productId} ×${component.quantity}`;
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
                      onChange={(event) => setForm((prev) => ({ ...prev, boxBarcode: event.target.value }))}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Cost Price</label>
                  <input
                    value={formatDz(computedCostPrice)}
                    readOnly
                    className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-lg text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Calculated from selected products</p>
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
                  <p className="text-xs text-muted-foreground mt-1">Currency: DZ</p>
                  {formErrors.sellingPrice && <p className="text-red-500 text-xs mt-1">{formErrors.sellingPrice}</p>}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-sm text-muted-foreground block">Components *</label>
                    <p className="text-xs text-muted-foreground">Select the inventory products included in one box.</p>
                  </div>
                  <button type="button" onClick={addComponent} className="px-3 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg hover:bg-primary/20 text-sm">
                    <Plus className="inline w-4 h-4 mr-1" /> Add Product
                  </button>
                </div>

                <div className="space-y-2">
                  {components.map((component, index) => {
                    const product = productMap.get(component.productId);
                    return (
                      <div key={`${index}-${component.productId || 'empty'}`} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center rounded-lg border border-border bg-muted/20 p-3">
                        <div>
                          <ProductPicker
                            products={products}
                            selectedProductId={component.productId}
                            onSelect={(product) => {
                              updateComponent(index, { productId: product.id, label: product.name });
                            }}
                          />
                          {component.label && !component.productId && <p className="mt-1 text-xs text-muted-foreground">Legacy label: {component.label}</p>}
                        </div>
                        <div>
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
                        <button type="button" onClick={() => removeComponent(index)} className="text-muted-foreground hover:text-red-500 px-2">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="col-span-3 text-xs text-muted-foreground flex flex-wrap gap-3 pl-1">
                          <span>{product ? `Stock: ${product.stock}` : 'No product selected'}</span>
                          <span>{product ? `Max boxes: ${Math.floor(product.stock / Math.max(1, Math.trunc(component.quantity)))}` : 'Max boxes: 0'}</span>
                        </div>
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
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => void handleSave()} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                {editingSerie ? 'Save Changes' : 'Add Box'}
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
                          <div className="font-medium">{product?.name || component.label || component.productId}</div>
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
