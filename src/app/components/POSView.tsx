import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Minus, X, Printer, ScanBarcode, User, PackageOpen, Pencil, Trash2 } from 'lucide-react';
import { getProducts, subscribeProducts, type Product } from './data/products';
import { getSeries, findSerieByBoxBarcode, refreshSeries, subscribeSeries, getSerieBoxQuantity, type Serie, type SerieComponent } from './data/series';
import { type Customer } from './data/customers';
import { checkoutSale } from './data/sales';
import { getErrorMessage } from './data/shared';
import { CustomerPicker } from './CustomerPicker';
import { BoxSaleModal } from './BoxSaleModal';
import { ItemImage } from './ItemImagePlaceholder';

type CartItem = (Product & { quantity: number; type: 'product' }) |
  { type: 'serie'; id: string; serieId: string; category: string; name: string; image: string; price: number; quantity: number; components: SerieComponent[] } |
  { type: 'serie-item'; id: string; serieId: string; serieName: string; size: string; category: string; name: string; image: string; price: number; quantity: number };

const categories = ['All', 'Shirts', 'Pants', 'Accessories'];

function formatDz(amount: number) {
  return `${amount.toFixed(2)} DZ`;
}

export function POSView() {
  const [products, setProducts] = useState(getProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [series, setSeries] = useState(getSeries);
  const [receipt, setReceipt] = useState<{
    items: CartItem[];
    subtotal: number;
    total: number;
    date: string;
    id: string;
    customer: Customer | null;
    isPartialPayment?: boolean;
    paidAmount?: number;
    remainingDebt?: number;
  } | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [boxSaleSerie, setBoxSaleSerie] = useState<Serie | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  // Partial payment state
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [paidAmountInput, setPaidAmountInput] = useState('');
  // Inline price editing state
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');
  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(null);
  const [editQuantityValue, setEditQuantityValue] = useState('');

  useEffect(() => {
    const unsubSeries = subscribeSeries(() => setSeries(getSeries()));
    const unsubProducts = subscribeProducts(() => {
      setProducts(getProducts());
      void refreshSeries();
    });
    return () => {
      unsubSeries();
      unsubProducts();
    };
  }, []);

  const addProductToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.type === 'product' && item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.type === 'product' && item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1, type: 'product' as const }];
    });
  };

  const addBoxToCart = (serie: Serie, quantity: number, components: SerieComponent[]) => {
    const normalizedQuantity = Math.max(1, Math.trunc(quantity));
    const normalizedComponents = components.map((component) => ({
      productId: component.productId,
      quantity: Math.max(1, Math.trunc(Number(component.quantity)) || 1),
      label: component.label,
    }));
    const configKey = JSON.stringify(normalizedComponents.map((component) => [component.productId, component.quantity]));
    const cartId = `serie-${serie.id}-${configKey}`;

    setCart((prev) => {
      const existing = prev.find((item) => item.type === 'serie' && item.id === cartId);
      if (existing) {
        return prev.map((item) => (item.type === 'serie' && item.id === cartId ? { ...item, quantity: item.quantity + normalizedQuantity } : item));
      }

      return [...prev, {
        type: 'serie' as const,
        id: cartId,
        serieId: serie.id,
        category: serie.category,
        name: `📦 ${serie.name}`,
        image: serie.image,
        price: serie.sellingPrice,
        quantity: normalizedQuantity,
        components: normalizedComponents,
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const startEditPrice = (item: CartItem) => {
    setEditingPriceId(item.id);
    setEditPriceValue(item.price.toFixed(2));
  };

  const confirmEditPrice = (id: string) => {
    const newPrice = parseFloat(editPriceValue);
    if (!isNaN(newPrice) && newPrice >= 0) {
      setCart((prev) =>
        prev.map((item) => item.id === id ? { ...item, price: newPrice } : item)
      );
    }
    setEditingPriceId(null);
    setEditPriceValue('');
  };

  const startEditQuantity = (item: CartItem) => {
    if (item.type === 'serie-item') return;
    setEditingQuantityId(item.id);
    setEditQuantityValue(String(item.quantity));
  };

  const confirmEditQuantity = (id: string) => {
    const newQuantity = Math.floor(Number(editQuantityValue));
    if (!Number.isNaN(newQuantity) && newQuantity > 0) {
      setCart((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity: newQuantity } : item))
      );
    }
    setEditingQuantityId(null);
    setEditQuantityValue('');
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery) || product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const showAvailableBoxes = searchQuery.trim().length === 0;

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutError('');

    if (isPartialPayment && !selectedCustomer) {
      setCheckoutError('A customer must be assigned for partial payments.');
      setShowCustomerPicker(true);
      return;
    }

    const paidAmountCents = isPartialPayment
      ? Math.round((parseFloat(paidAmountInput) || 0) * 100)
      : undefined;

    try {
      const result = await checkoutSale({
        sourceView: 'pos',
        customerId: selectedCustomer?.id ?? null,
        items: cart,
        partialPayment: isPartialPayment,
        paidAmountCents,
      });

      setReceipt({
        items: [...cart],
        subtotal,
        total,
        date: new Date(result.soldAt).toLocaleString(),
        id: result.receiptNumber,
        customer: selectedCustomer,
        isPartialPayment: !!result.debtId,
        paidAmount: result.paidAmountCents / 100,
        remainingDebt: result.remainingCents / 100,
      });
      setCart([]);
      setSelectedCustomer(null);
      setIsPartialPayment(false);
      setPaidAmountInput('');
    } catch (error) {
      setCheckoutError(getErrorMessage(error));
    }
  };

  const handleClearAll = () => {
    setCart([]);
    setEditingPriceId(null);
    setEditPriceValue('');
    setEditingQuantityId(null);
    setEditQuantityValue('');
    setCheckoutError('');
    setIsPartialPayment(false);
    setPaidAmountInput('');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow || !receipt) return;
    const customerLine = receipt.customer
      ? `<div class="row"><span>Customer: ${receipt.customer.name}</span></div>`
      : '';
    const partialPaymentBlock = receipt.isPartialPayment
      ? `
        <div class="line"></div>
        <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Partially Paid</div>
        <div class="row"><span>Amount Paid</span><span>${formatDz(receipt.paidAmount ?? 0)}</span></div>
        <div class="row"><span>Remaining Debt</span><span>${formatDz(receipt.remainingDebt ?? 0)}</span></div>
      `
      : '';
    printWindow.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body { font-family: 'Courier New', monospace; width: 280px; margin: 0 auto; padding: 20px 0; color: #1a1a1a; }
        .center { text-align: center; }
        .line { border-top: 1px dashed #999; margin: 10px 0; }
        .row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
        .bold { font-weight: bold; }
        h2 { margin: 0 0 4px; font-size: 18px; }
        p { margin: 2px 0; font-size: 12px; }
      </style></head><body>
        <div class="center">
          <h2>CLOTHING STORE</h2>
          <p>123 Fashion Ave, Suite 100</p>
          <p>Tel: (555) 000-1234</p>
        </div>
        <div class="line"></div>
        <div class="row"><span>Receipt: ${receipt.id}</span></div>
        <div class="row"><span>${receipt.date}</span></div>
        ${customerLine}
        <div class="line"></div>
        ${receipt.items.map(item => `
          <div class="row"><span>${item.name} x${item.quantity}</span><span>${formatDz(item.price * item.quantity)}</span></div>
        `).join('')}
        <div class="line"></div>
        <div class="row bold" style="font-size:15px"><span>TOTAL</span><span>${formatDz(receipt.total)}</span></div>
        ${partialPaymentBlock}
        <div class="line"></div>
        <div class="center"><p style="margin-top:12px">Thank you for shopping!</p><p>Have a great day</p></div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const serieByBox = findSerieByBoxBarcode(code);
    if (serieByBox) {
      setBoxSaleSerie(serieByBox);
      setBarcodeError('');
      setBarcodeInput('');
      barcodeRef.current?.focus();
      return;
    }

    const foundProduct = products.find((p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase());

    if (foundProduct) {
      addProductToCart(foundProduct);
      setBarcodeError('');
    } else {
      setBarcodeError(`No product found for "${code}"`);
    }
    setBarcodeInput('');
    barcodeRef.current?.focus();
  };

  return (
    <div className="flex-1 flex h-full">
      <div className="flex-[60] p-8 overflow-auto">
        <div className="mb-6">
          <h1>Point of Sale</h1>
          <p className="text-muted-foreground mt-1">Select items to add to cart</p>
        </div>

        {/* Barcode Input */}
        <form onSubmit={handleBarcodeSubmit} className="mb-4">
          <div className="relative">
            <ScanBarcode className="absolute left-3.5 top-1/2 -translate-y-1/2 w-6 h-6 text-primary" />
            <input
              ref={barcodeRef} type="text"
              placeholder="Scan or type barcode / SKU and press Enter..."
              value={barcodeInput}
              onChange={(e) => { setBarcodeInput(e.target.value); setBarcodeError(''); }}
              className="w-full pl-12 pr-4 py-3 bg-primary/5 border-2 border-primary/30 rounded-lg focus:border-primary focus:outline-none transition-colors"
            />
          </div>
          {barcodeError && <p className="text-red-500 text-sm mt-1">{barcodeError}</p>}
        </form>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
            <input type="text" placeholder="Search products..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-input-background border border-border rounded-lg" />
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          {categories.map((category) => (
            <button key={category} onClick={() => setSelectedCategory(category)}
              className={`px-5 py-2.5 rounded-full transition-colors ${
                selectedCategory === category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}>{category}</button>
          ))}
        </div>

        {/* Series Cards */}
        {showAvailableBoxes && series.filter(s => getSerieBoxQuantity(s) > 0).length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5"><PackageOpen className="w-4 h-4" /> Available Boxes</h3>
            <div className="grid grid-cols-3 gap-4">
              {series.filter(s => getSerieBoxQuantity(s) > 0).map(s => (
                <button key={s.id} onClick={() => { setBoxSaleSerie(s); setBarcodeError(''); }}
                  className="bg-card border-2 border-primary/20 rounded-lg p-4 text-left hover:border-primary transition-colors relative">
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                    📦 {getSerieBoxQuantity(s)} box{getSerieBoxQuantity(s) > 1 ? 'es' : ''}
                  </div>
                  <ItemImage src={s.image} alt={s.name} category={s.category} className="aspect-square bg-muted rounded-lg mb-3" iconClassName="w-8 h-8" />
                  <div className="text-sm text-muted-foreground mb-1">{s.category}</div>
                  <div className="mb-2 text-sm">{s.name}</div>
                  <div className="text-primary">{s.sellingPrice.toFixed(2)} DZ</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <button key={product.id} onClick={() => addProductToCart(product)}
              className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary transition-colors">
              <ItemImage src={product.image} alt={product.name} category={product.category} className="aspect-square bg-slate-100 rounded-lg mb-3 border border-slate-200" iconClassName="w-8 h-8" />
              <div className="text-sm text-muted-foreground mb-1">{product.category}</div>
              <div className="mb-2">{product.name}</div>
              <div className="text-primary">{formatDz(product.price)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Panel */}
      <div className="flex-[40] bg-card border-l border-border flex flex-col">
        <div className="p-6 border-b border-border flex items-center justify-between gap-3">
          <h2>Current Order</h2>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>

        {/* Customer Selection */}
        <div className="px-6 pt-4">
          <button onClick={() => setShowCustomerPicker(true)}
            className="w-full flex items-center gap-3 p-3.5 rounded-lg border border-dashed border-border hover:border-primary transition-colors text-left">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedCustomer ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {selectedCustomer ? selectedCustomer.name.charAt(0) : <User className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm">{selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}</div>
              <div className="text-xs text-muted-foreground truncate">
                {selectedCustomer ? selectedCustomer.email : 'Tap to assign a customer (optional)'}
              </div>
            </div>
            {selectedCustomer && (
              <button onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">No items in cart</div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <ItemImage src={item.image} alt={item.name} category={item.category} className={`w-16 h-16 rounded-lg flex-shrink-0 border border-slate-200 ${item.type === 'serie' ? 'ring-2 ring-primary/30' : 'bg-slate-100'}`} iconClassName="w-6 h-6" />
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 text-sm">{item.name}</div>
                    {item.type === 'serie' && item.components.length > 0 && (
                      <div className="mb-1 text-xs text-muted-foreground truncate">
                        {item.components.map((component) => {
                          const product = products.find((entry) => entry.id === component.productId);
                          return `${product?.name || component.label || component.productId} ×${component.quantity}`;
                        }).join(', ')}
                      </div>
                    )}
                    {editingPriceId === item.id ? (
                      <form onSubmit={(e) => { e.preventDefault(); confirmEditPrice(item.id); }} className="flex items-center gap-1.5">
                        <span className="text-sm text-muted-foreground">DZ</span>
                        <input
                          type="number" step="0.01" min="0"
                          value={editPriceValue}
                          onChange={(e) => setEditPriceValue(e.target.value)}
                          onBlur={() => confirmEditPrice(item.id)}
                          autoFocus
                          className="w-24 px-2 py-1 text-sm border border-primary rounded-md bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </form>
                    ) : (
                      <button onClick={() => startEditPrice(item)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors group">
                        <span>{formatDz(item.price)}</span>
                        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                    {(item.type === 'product' || item.type === 'serie') ? (
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 rounded bg-secondary hover:bg-muted flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                        {editingQuantityId === item.id ? (
                          <form onSubmit={(e) => { e.preventDefault(); confirmEditQuantity(item.id); }}>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              autoFocus
                              value={editQuantityValue}
                              onChange={(e) => setEditQuantityValue(e.target.value)}
                              onBlur={() => confirmEditQuantity(item.id)}
                            className="w-16 px-2 py-1 text-center text-sm border border-primary rounded-md bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditQuantity(item)}
                            className="w-10 text-center text-sm font-medium hover:text-primary transition-colors group flex items-center justify-center gap-1"
                            title="Edit quantity"
                          >
                            <span>{item.quantity}</span>
                            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 rounded bg-secondary hover:bg-muted flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                      </div>
                    ) : null}
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-muted-foreground hover:text-destructive"><X className="w-6 h-6" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border space-y-6">
          {checkoutError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{checkoutError}</div>}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatDz(subtotal)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-border">
              <span>Total</span>
              <span className="text-lg">{formatDz(total)}</span>
            </div>
          </div>
          {/* Partial Payment Toggle */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPartialPayment}
                onChange={(e) => {
                  setIsPartialPayment(e.target.checked);
                  if (!e.target.checked) setPaidAmountInput('');
                }}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm">Partial Payment (Debt)</span>
            </label>
            {isPartialPayment && (
              <div className="space-y-2 pl-7">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Amount Paid</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmountInput}
                    onChange={(e) => setPaidAmountInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
                  />
                </div>
                {paidAmountInput && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Remaining debt</span>
                    <span className="text-red-600 font-medium">
                      {formatDz(Math.max(0, total - (parseFloat(paidAmountInput) || 0)))}
                    </span>
                  </div>
                )}
                {!selectedCustomer && (
                  <p className="text-xs text-amber-600">A customer is required for partial payments.</p>
                )}
              </div>
            )}
          </div>

          <button disabled={cart.length === 0} onClick={handleCheckout}
            className="w-full py-5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md">
            {isPartialPayment ? 'Checkout with Debt' : 'Checkout / Pay'}
          </button>
        </div>
      </div>

      {/* Customer Picker Modal */}
      {showCustomerPicker && (
        <CustomerPicker selectedCustomer={selectedCustomer} onSelect={setSelectedCustomer} onClose={() => setShowCustomerPicker(false)} />
      )}

      {boxSaleSerie && (
        <BoxSaleModal
          serie={boxSaleSerie}
          products={products}
          onConfirm={({ quantity, components }) => {
            addBoxToCart(boxSaleSerie, quantity, components);
            setBoxSaleSerie(null);
          }}
          onClose={() => setBoxSaleSerie(null)}
        />
      )}

      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <div className="text-center mb-4">
                <h2 className="text-lg">CLOTHING STORE</h2>
                <p className="text-sm text-muted-foreground">123 Fashion Ave, Suite 100</p>
                <p className="text-sm text-muted-foreground">Tel: (555) 000-1234</p>
              </div>
              <div className="border-t border-dashed border-gray-300 my-3" />
              <div className="flex justify-between text-sm text-muted-foreground mb-1"><span>Receipt: {receipt.id}</span></div>
              <div className="text-sm text-muted-foreground mb-1">{receipt.date}</div>
              {receipt.customer && <div className="text-sm text-muted-foreground mb-1">Customer: {receipt.customer.name}</div>}
              <div className="border-t border-dashed border-gray-300 my-3" />
              <div className="space-y-2">
                {receipt.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.name} x{item.quantity}</span>
                    <span>{formatDz(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-gray-300 my-3" />
              <div className="flex justify-between"><span>TOTAL</span><span>{formatDz(receipt.total)}</span></div>
              {receipt.isPartialPayment && (
                <>
                  <div className="border-t border-dashed border-gray-300 my-3" />
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide">Partially Paid</div>
                    <div className="flex justify-between text-sm">
                      <span>Amount Paid</span>
                      <span className="font-medium">{formatDz(receipt.paidAmount ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Remaining Debt</span>
                      <span className="font-medium">{formatDz(receipt.remainingDebt ?? 0)}</span>
                    </div>
                  </div>
                </>
              )}
              <div className="text-center text-sm text-muted-foreground mt-4">Thank you for shopping!</div>
            </div>
            <div className="flex gap-3 p-4 border-t border-border">
              <button onClick={() => setReceipt(null)} className="flex-1 py-3 border border-border rounded-lg hover:bg-muted transition-colors">Close</button>
              <button onClick={handlePrint} className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                <Printer className="w-5 h-5" /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
