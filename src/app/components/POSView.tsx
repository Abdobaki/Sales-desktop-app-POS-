import { useState, useRef } from 'react';
import { Search, Plus, Minus, X, Printer, ScanBarcode, User } from 'lucide-react';
import { productCatalog, type Product } from './data/products';
import { type Customer } from './data/customers';
import { CustomerPicker } from './CustomerPicker';

type CartItem = Product & { quantity: number };

const categories = ['All', 'Shirts', 'Pants', 'Accessories'];

export function POSView() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
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
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const filteredProducts = productCatalog.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery) || product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
    const found = productCatalog.find((p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase());
    if (found) {
      addToCart(found);
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
              ref={barcodeRef}
              type="text"
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
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-input-background border border-border rounded-lg"
            />
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-5 py-2.5 rounded-full transition-colors ${
                selectedCategory === category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary transition-colors"
            >
              <div className="aspect-square bg-muted rounded-lg mb-3 overflow-hidden">
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm text-muted-foreground mb-1">{product.category}</div>
              <div className="mb-2">{product.name}</div>
              <div className="text-primary">${product.price.toFixed(2)}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-[40] bg-card border-l border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <h2>Current Order</h2>
        </div>

        {/* Customer Selection */}
        <div className="px-6 pt-4">
          <button
            onClick={() => setShowCustomerPicker(true)}
            className="w-full flex items-center gap-3 p-3.5 rounded-lg border border-dashed border-border hover:border-primary transition-colors text-left"
          >
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
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              No items in cart
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="mb-1">{item.name}</div>
                    <div className="text-sm text-muted-foreground">${item.price.toFixed(2)}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-8 h-8 rounded bg-secondary hover:bg-muted flex items-center justify-center"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-8 h-8 rounded bg-secondary hover:bg-muted flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-6 h-6" />
                  </button>
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
            className="w-full py-5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
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
                className="flex-1 py-3 border border-border rounded-lg hover:bg-muted transition-colors"
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