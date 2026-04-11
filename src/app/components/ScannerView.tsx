import { useState, useRef, useEffect } from 'react';
import { ScanBarcode, Plus, Minus, X, Printer, Trash2, CheckCircle2, AlertCircle, User } from 'lucide-react';
import { productCatalog, type Product } from './data/products';
import { type Customer } from './data/customers';
import { CustomerPicker } from './CustomerPicker';

type CartItem = Product & { quantity: number };

type ScanLog = {
  id: string;
  barcode: string;
  productName: string | null;
  success: boolean;
  time: string;
};

export function ScannerView() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lastScanned, setLastScanned] = useState<Product | null>(null);
  const [scanError, setScanError] = useState('');
  const [scanLog, setScanLog] = useState<ScanLog[]>([]);
  const [receipt, setReceipt] = useState<{ items: CartItem[]; subtotal: number; total: number; date: string; id: string; customer: Customer | null } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const found = productCatalog.find(
      (p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase()
    );

    const now = new Date().toLocaleTimeString();
    if (found) {
      addToCart(found);
      setLastScanned(found);
      setScanError('');
      setScanLog((prev) => [
        { id: `${Date.now()}`, barcode: code, productName: found.name, success: true, time: now },
        ...prev,
      ].slice(0, 20));
    } else {
      setLastScanned(null);
      setScanError(`No product found for barcode "${code}"`);
      setScanLog((prev) => [
        { id: `${Date.now()}`, barcode: code, productName: null, success: false, time: now },
        ...prev,
      ].slice(0, 20));
    }

    setBarcodeInput('');
    inputRef.current?.focus();
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setReceipt({
      items: [...cart],
      subtotal,
      total,
      date: new Date().toLocaleString(),
      id: `REC-${Date.now().toString(36).toUpperCase()}`,
      customer: selectedCustomer,
    });
    setCart([]);
    setScanLog([]);
    setLastScanned(null);
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

  return (
    <div className="flex-1 flex h-full">
      {/* Left: Scanner + Log */}
      <div className="flex-[55] p-8 overflow-auto flex flex-col">
        <div className="mb-6">
          <h1>Barcode Scanner</h1>
          <p className="text-muted-foreground mt-1">Scan items to add them to the sale</p>
        </div>

        {/* Scanner Input */}
        <form onSubmit={handleScan} className="mb-6">
          <div className="relative">
            <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-primary" />
            <input
              ref={inputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => { setBarcodeInput(e.target.value); setScanError(''); }}
              placeholder="Scan barcode or type code here..."
              className="w-full pl-12 pr-4 py-4 text-lg bg-primary/5 border-2 border-primary/30 rounded-xl focus:border-primary focus:outline-none transition-colors"
              autoFocus
            />
          </div>
          {scanError && (
            <div className="flex items-center gap-2 mt-2 text-red-500 text-sm">
              <AlertCircle className="w-5 h-5" />
              {scanError}
            </div>
          )}
        </form>

        {/* Last Scanned Feedback */}
        {lastScanned && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
              <img src={lastScanned.image} alt={lastScanned.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-green-700 mb-1">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm">Item added</span>
              </div>
              <div>{lastScanned.name}</div>
              <div className="text-sm text-muted-foreground">
                {lastScanned.barcode} &middot; ${lastScanned.price.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Quick Reference: Available Barcodes */}
        <div className="mb-6 bg-card border border-border rounded-xl p-5">
          <h3 className="mb-3 text-sm text-muted-foreground">Quick Reference — Sample Barcodes</h3>
          <div className="grid grid-cols-2 gap-2">
            {productCatalog.map((p) => (
              <button
                key={p.id}
                onClick={() => { addToCart(p); setLastScanned(p); setScanError(''); setScanLog((prev) => [{ id: `${Date.now()}`, barcode: p.barcode, productName: p.name, success: true, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 20)); }}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className="w-8 h-8 rounded bg-muted overflow-hidden flex-shrink-0">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{p.barcode}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Scan Log */}
        {scanLog.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm text-muted-foreground">Scan History</h3>
              <button
                onClick={() => setScanLog([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-auto">
              {scanLog.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between py-1.5 px-2 rounded text-sm ${
                    entry.success ? 'text-foreground' : 'text-red-500 bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {entry.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    )}
                    <span className="font-mono">{entry.barcode}</span>
                    {entry.productName && (
                      <span className="text-muted-foreground">&middot; {entry.productName}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{entry.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: Cart */}
      <div className="flex-[45] bg-card border-l border-border flex flex-col">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2>Sale Items</h2>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-sm text-muted-foreground hover:text-red-600 flex items-center gap-1"
            >
              <Trash2 className="w-5 h-5" />
              Clear
            </button>
          )}
        </div>

        {/* Customer Selection */}
        <div className="px-6 pt-4">
          <button
            onClick={() => setShowCustomerPicker(true)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-border hover:border-primary transition-colors text-left"
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${selectedCustomer ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {selectedCustomer ? selectedCustomer.name.charAt(0) : <User className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm">{selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}</div>
              <div className="text-xs text-muted-foreground truncate">
                {selectedCustomer ? selectedCustomer.email : 'Tap to assign a customer (optional)'}
              </div>
            </div>
            {selectedCustomer && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <ScanBarcode className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Scan a barcode to start</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="w-14 h-14 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm mb-0.5 truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground font-mono mb-1">{item.barcode}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded bg-secondary hover:bg-muted flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded bg-secondary hover:bg-muted flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <span className="text-sm text-primary">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
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
          <button
            disabled={cart.length === 0}
            onClick={handleCheckout}
            className="w-full py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
          >
            Checkout / Pay
          </button>
        </div>
      </div>

      {/* Customer Picker Modal */}
      {showCustomerPicker && (
        <CustomerPicker
          selectedCustomer={selectedCustomer}
          onSelect={setSelectedCustomer}
          onClose={() => setShowCustomerPicker(false)}
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
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Receipt: {receipt.id}</span>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{receipt.date}</div>
              {receipt.customer && (
                <div className="text-sm text-muted-foreground mb-1">Customer: {receipt.customer.name}</div>
              )}
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
              <div className="flex justify-between">
                <span>TOTAL</span>
                <span>${receipt.total.toFixed(2)}</span>
              </div>
              <div className="text-center text-sm text-muted-foreground mt-4">Thank you for shopping!</div>
            </div>
            <div className="flex gap-3 p-4 border-t border-border">
              <button
                onClick={() => setReceipt(null)}
                className="flex-1 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Close
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}