import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { type Product } from './data/products';
import { ProductPicker } from './ProductPicker';
import { getSerieBoxQuantity, type Serie, type SerieComponent } from './data/series';

type BoxSaleModalProps = {
  serie: Serie;
  products: Product[];
  onConfirm: (payload: { quantity: number; components: SerieComponent[] }) => void;
  onClose: () => void;
};

type ComponentDraft = SerieComponent;

function cloneComponents(components: SerieComponent[]) {
  return components.map((component) => ({ ...component }));
}

function formatDz(amount: number) {
  return `${amount.toFixed(2)} DZD`;
}

export function BoxSaleModal({ serie, products, onConfirm, onClose }: BoxSaleModalProps) {
  const initialComponents = useMemo<ComponentDraft[]>(() => {
    if (serie.components.length > 0) {
      return cloneComponents(serie.components);
    }

    if (serie.legacyItems && serie.legacyItems.length > 0) {
      return serie.legacyItems.map((item) => ({
        productId: '',
        quantity: item.quantity,
        label: item.size,
      }));
    }

    const firstProduct = products[0];
    if (!firstProduct) {
      return [{ productId: '', quantity: 1 }];
    }

    return [{ productId: firstProduct.id, quantity: 1, label: firstProduct.name }];
  }, [products, serie.components, serie.legacyItems, serie.id]);

  const [quantity, setQuantity] = useState('1');
  const [components, setComponents] = useState<ComponentDraft[]>(initialComponents);
  const [error, setError] = useState('');

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const availableBoxes = useMemo(
    () => getSerieBoxQuantity({ ...serie, components }),
    [components, serie]
  );
  const componentUnits = useMemo(
    () => components.reduce((sum, component) => sum + Math.max(1, Math.trunc(component.quantity)), 0),
    [components]
  );

  useEffect(() => {
    setQuantity('1');
    setComponents(initialComponents);
    setError('');
  }, [initialComponents]);

  const updateComponent = (index: number, patch: Partial<ComponentDraft>) => {
    setComponents((prev) => prev.map((component, currentIndex) => (currentIndex === index ? { ...component, ...patch } : component)));
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
    setComponents((prev) => (prev.length === 1 ? prev : prev.filter((_, currentIndex) => currentIndex !== index)));
  };

  const resetToDefaults = () => {
    setComponents(initialComponents);
    setError('');
  };

  const handleConfirm = () => {
    const boxQuantity = Math.trunc(Number(quantity));
    if (!Number.isFinite(boxQuantity) || boxQuantity <= 0) {
      setError('Box quantity must be at least 1.');
      return;
    }

    if (components.length === 0) {
      setError('Add at least one product to the box.');
      return;
    }

    if (components.some((component) => !component.productId)) {
      setError('Select a product for every box component.');
      return;
    }

    if (components.some((component) => Math.trunc(Number(component.quantity)) <= 0)) {
      setError('Every component quantity must be at least 1.');
      return;
    }

    const selectedProducts = components.map((component) => component.productId);
    if (new Set(selectedProducts).size !== selectedProducts.length) {
      setError('Do not repeat the same product more than once.');
      return;
    }

    if (availableBoxes <= 0) {
      setError('This box cannot be sold with the current inventory.');
      return;
    }

    if (boxQuantity > availableBoxes) {
      setError(`Only ${availableBoxes} box${availableBoxes === 1 ? '' : 'es'} can be sold with the current selection.`);
      return;
    }

    onConfirm({
      quantity: boxQuantity,
      components: components.map((component) => ({
        productId: component.productId,
        quantity: Math.max(1, Math.trunc(Number(component.quantity))),
        label: component.label,
      })),
    });
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="mb-1">Configure Box Sale</h2>
            <p className="text-sm text-muted-foreground">{serie.name} · default contents are preloaded below.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Box Quantity</label>
                <input
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  type="number"
                  min="1"
                  step="1"
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Available Boxes</label>
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
                  {availableBoxes}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Box Contents</h3>
                <p className="text-xs text-muted-foreground">Pick products from inventory and define the quantity for each box.</p>
              </div>
              <button
                type="button"
                onClick={addComponent}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </button>
            </div>

            <div className="space-y-3">
              {components.map((component, index) => {
                const product = productMap.get(component.productId);
                const stock = Math.max(0, Math.trunc(product?.stock ?? 0));
                const maxBoxes = product ? Math.floor(stock / Math.max(1, Math.trunc(component.quantity))) : 0;

                return (
                  <div key={`${index}-${component.productId || 'empty'}`} className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="grid gap-3 md:grid-cols-[1.6fr_0.5fr_auto] md:items-end">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Product</label>
                        <ProductPicker
                          products={products}
                          selectedProductId={component.productId}
                          onSelect={(product) => {
                            updateComponent(index, { productId: product.id, label: product.name });
                          }}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Qty per Box</label>
                        <input
                          value={component.quantity}
                          onChange={(event) => updateComponent(index, { quantity: Math.max(1, Math.trunc(Number(event.target.value)) || 1) })}
                          type="number"
                          min="1"
                          step="1"
                          className="w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeComponent(index)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-red-600"
                        title="Remove component"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{product ? `Stock: ${stock}` : 'No product selected'}</span>
                      <span>Max boxes: {maxBoxes}</span>
                      {product && <span>Cost: {formatDz(product.costPrice * Math.max(1, Math.trunc(component.quantity)))}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
            <div>
              <h3 className="mb-1 text-sm font-medium">Preview</h3>
              <p className="text-xs text-muted-foreground">This is the default package configuration saved for the box.</p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-card px-3 py-2 border border-border">
                <span className="text-muted-foreground">Box price</span>
                <span>{formatDz(serie.sellingPrice)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-card px-3 py-2 border border-border">
                <span className="text-muted-foreground">Box cost</span>
                <span>{formatDz(serie.costPrice)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-card px-3 py-2 border border-border">
                <span className="text-muted-foreground">Units per box</span>
                <span>{componentUnits}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={resetToDefaults}
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm hover:bg-muted"
              >
                Reset defaults
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Add to cart
              </button>
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
