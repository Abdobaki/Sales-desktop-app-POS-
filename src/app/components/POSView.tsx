import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Minus, X, Printer, ScanBarcode, User, PackageOpen, Pencil } from 'lucide-react';
import { productCatalog, getProducts, subscribeProducts, type Product } from './data/products';
import { getSeries, findSerieByBoxBarcode, findSeriesByProductBarcode, sellSerieItem, subscribeSeries, getSerieRemainingCount, getSerieAvailableSizes, type Serie } from './data/series';
import { type Customer } from './data/customers';
import { CustomerPicker } from './CustomerPicker';

type CartItem = (Product & { quantity: number; type: 'product' }) |
  { type: 'serie'; id: string; serieId: string; name: string; image: string; price: number; quantity: number } |
  { type: 'serie-item'; id: string; serieId: string; serieName: string; size: string; name: string; image: string; price: number; quantity: number };

const categories = ['All', 'Shirts', 'Pants', 'Accessories'];

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
  } | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  // Serie choice dialog state
  const [serieChoice, setSerieChoice] = useState<{ series: Serie[]; productBarcode: string } | null>(null);
  const [sizePickSerie, setSizePickSerie] = useState<Serie | null>(null);
  // Inline price editing state
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');

  useEffect(() => {
    const unsubSeries = subscribeSeries(() => setSeries(getSeries()));
    const unsubProducts = subscribeProducts(() => setProducts(getProducts()));
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

  const addSerieToCart = (serie: Serie) => {
    const remaining = getSerieRemainingCount(serie);
    if (remaining === 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.type === 'serie' && item.serieId === serie.id);
      if (existing) return prev; // Can only add one box
      return [...prev, {
        type: 'serie' as const, id: `serie-${serie.id}`, serieId: serie.id,
        name: `📦 ${serie.name} (${remaining} items)`, image: serie.image,
        price: serie.sellingPrice, quantity: 1,
      }];
    });
  };

  const addSerieItemToCart = (serie: Serie, size: string) => {
    const price = serie.unitPrice;
    const cartId = `si-${serie.id}-${size}`;
    setCart((prev) => {
      const existing = prev.find((item) => item.type === 'serie-item' && item.id === cartId);
      if (existing) return prev; // Can only sell each size once
      return [...prev, {
        type: 'serie-item' as const, id: cartId, serieId: serie.id,
        serieName: serie.name, size, name: `${serie.name} — Size ${size}`,
        image: serie.image, price, quantity: 1,
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

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery) || product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    // Process serie items - mark as sold
    cart.forEach((item) => {
      if (item.type === 'serie-item') {
        sellSerieItem(item.serieId, item.size);
      } else if (item.type === 'serie') {
        // Sell all remaining items in the serie
        const serie = getSeries().find(s => s.id === item.serieId);
        if (serie) {
          serie.items.filter(i => !i.sold).forEach(i => sellSerieItem(serie.id, i.size));
        }
      }
    });
    setReceipt({
      items: [...cart], subtotal, total,
      date: new Date().toLocaleString(),
      id: `REC-${Date.now().toString(36).toUpperCase()}`,
      customer: selectedCustomer,
    });
    setCart([]);
    setSelectedCustomer(null);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow || !receipt) return;
    const customerLine = receipt.customer
      ? `<div class="row"><span>Customer: ${receipt.customer.name}</span></div>`
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
          <div class="row"><span>${item.name} x${item.quantity}</span><span>$${(item.price * item.quantity).toFixed(2)}</span></div>
        `).join('')}
        <div class="line"></div>
        <div class="row bold" style="font-size:15px"><span>TOTAL</span><span>$${receipt.total.toFixed(2)}</span></div>
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
    // 1. Check if it's a box barcode
    const serieByBox = findSerieByBoxBarcode(code);
    if (serieByBox) {
      addSerieToCart(serieByBox);
      setBarcodeError('');
      setBarcodeInput('');
      barcodeRef.current?.focus();
      return;
    }

    // 2. Check if it's a product barcode that also matches series
    const matchingSeries = findSeriesByProductBarcode(code);
    const foundProduct = products.find((p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase());

    if (matchingSeries.length > 0 && foundProduct) {
      // Show choice dialog
      setSerieChoice({ series: matchingSeries, productBarcode: code });
      setBarcodeError('');
      setBarcodeInput('');
      barcodeRef.current?.focus();
      return;
    }

    if (matchingSeries.length > 0) {
      // No individual product, just series
      if (matchingSeries.length === 1) {
        setSizePickSerie(matchingSeries[0]);
      } else {
        setSerieChoice({ series: matchingSeries, productBarcode: code });
      }
      setBarcodeError('');
      setBarcodeInput('');
      barcodeRef.current?.focus();
      return;
    }

    // 3. Regular product
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
        {series.filter(s => getSerieRemainingCount(s) > 0).length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5"><PackageOpen className="w-4 h-4" /> Available Series</h3>
            <div className="grid grid-cols-3 gap-4">
              {series.filter(s => getSerieRemainingCount(s) > 0).map(s => (
                <button key={s.id} onClick={() => addSerieToCart(s)}
                  className="bg-card border-2 border-primary/20 rounded-lg p-4 text-left hover:border-primary transition-colors relative">
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                    📦 {getSerieRemainingCount(s)} items
                  </div>
                  <div className="aspect-square bg-muted rounded-lg mb-3 overflow-hidden">
                    <img src={s.image} alt={s.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">{s.category}</div>
                  <div className="mb-2 text-sm">{s.name}</div>
                  <div className="text-primary">${s.sellingPrice.toFixed(2)}</div>
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
              <div className="aspect-square bg-slate-100 rounded-lg mb-3 overflow-hidden border border-slate-200">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="text-sm text-muted-foreground mb-1">{product.category}</div>
              <div className="mb-2">{product.name}</div>
              <div className="text-primary">${product.price.toFixed(2)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Panel */}
      <div className="flex-[40] bg-card border-l border-border flex flex-col">
        <div className="p-6 border-b border-border"><h2>Current Order</h2></div>

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
                  <div className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200 ${item.type === 'serie' ? 'ring-2 ring-primary/30' : 'bg-slate-100'}`}>
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 text-sm">{item.name}</div>
                    {editingPriceId === item.id ? (
                      <form onSubmit={(e) => { e.preventDefault(); confirmEditPrice(item.id); }} className="flex items-center gap-1.5">
                        <span className="text-sm text-muted-foreground">$</span>
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
                        <span>${item.price.toFixed(2)}</span>
                        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                    {item.type === 'product' && (
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 rounded bg-secondary hover:bg-muted flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 rounded bg-secondary hover:bg-muted flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-muted-foreground hover:text-destructive"><X className="w-6 h-6" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-border">
              <span>Total</span>
              <span className="text-lg">${total.toFixed(2)}</span>
            </div>
          </div>
          <button disabled={cart.length === 0} onClick={handleCheckout}
            className="w-full py-5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md">
            Checkout / Pay
          </button>
        </div>
      </div>

      {/* Customer Picker Modal */}
      {showCustomerPicker && (
        <CustomerPicker selectedCustomer={selectedCustomer} onSelect={setSelectedCustomer} onClose={() => setShowCustomerPicker(false)} />
      )}

      {/* Serie Choice Dialog — product barcode matches both product and series */}
      {serieChoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="mb-2">This barcode matches a serie</h2>
            <p className="text-sm text-muted-foreground mb-4">How would you like to sell this item?</p>
            <div className="space-y-2">
              <button onClick={() => {
                const p = productCatalog.find(p => p.barcode === serieChoice.productBarcode || p.sku.toLowerCase() === serieChoice.productBarcode.toLowerCase());
                if (p) addProductToCart(p);
                setSerieChoice(null);
              }} className="w-full p-3 border border-border rounded-lg hover:bg-muted transition-colors text-left">
                <div className="font-medium text-sm">Sell as individual product</div>
                <div className="text-xs text-muted-foreground">Uses the product's own price</div>
              </button>
              {serieChoice.series.map(s => (
                <button key={s.id} onClick={() => { setSizePickSerie(s); setSerieChoice(null); }}
                  className="w-full p-3 border-2 border-primary/20 rounded-lg hover:border-primary transition-colors text-left">
                  <div className="font-medium text-sm">Sell from: {s.name}</div>
                  <div className="text-xs text-muted-foreground">Pick a size — {getSerieRemainingCount(s)} items remaining</div>
                </button>
              ))}
            </div>
            <button onClick={() => setSerieChoice(null)} className="w-full mt-3 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {/* Size Pick Dialog */}
      {sizePickSerie && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="mb-1">Pick a size</h2>
            <p className="text-sm text-muted-foreground mb-4">From: {sizePickSerie.name}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {sizePickSerie.items.map((item, i) => {
                const remaining = item.quantity - item.sold;
                const isSoldOut = remaining === 0;
                return (
                  <button key={i} disabled={isSoldOut}
                    onClick={() => { addSerieItemToCart(sizePickSerie, item.size); setSizePickSerie(null); }}
                    className={`px-4 py-2.5 rounded-lg text-sm transition-colors ${
                      isSoldOut ? 'bg-muted text-muted-foreground cursor-not-allowed line-through' : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/30'
                    }`}>{item.size} {item.quantity > 1 ? `(${remaining} left)` : ''}</button>
                );
              })}
            </div>
            <button onClick={() => setSizePickSerie(null)} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
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
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-gray-300 my-3" />
              <div className="flex justify-between"><span>TOTAL</span><span>${receipt.total.toFixed(2)}</span></div>
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
