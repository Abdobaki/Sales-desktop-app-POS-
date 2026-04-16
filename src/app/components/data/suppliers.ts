export type Purchase = {
  id: string;
  supplierId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  date: string;
  receiptImage: string; // base64 data-url or empty
  notes: string;
};

export type Supplier = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  totalSpent: number;
  totalPurchases: number;
  createdAt: string;
};

let _suppliers: Supplier[] = [
  {
    id: '1',
    name: 'Ahmed Benali',
    company: 'Textile Express',
    phone: '(555) 111-2222',
    email: 'ahmed@textileexpress.com',
    address: '45 Industrial Zone, Casablanca',
    totalSpent: 12450.0,
    totalPurchases: 8,
    createdAt: '2025-11-15',
  },
  {
    id: '2',
    name: 'Maria Santos',
    company: 'Euro Fabrics Co.',
    phone: '(555) 333-4444',
    email: 'maria@eurofabrics.com',
    address: '12 Commerce St, Lisbon',
    totalSpent: 8920.5,
    totalPurchases: 5,
    createdAt: '2026-01-08',
  },
  {
    id: '3',
    name: 'Chen Wei',
    company: 'Dragon Textiles Ltd.',
    phone: '(555) 555-6666',
    email: 'chen@dragontextiles.com',
    address: '88 Silk Road, Shanghai',
    totalSpent: 22340.0,
    totalPurchases: 12,
    createdAt: '2025-09-20',
  },
];

let _purchases: Purchase[] = [
  { id: 'p1', supplierId: '1', productName: 'Classic White T-Shirt (Bulk)', quantity: 200, unitPrice: 8.5, totalPrice: 1700, date: '2026-03-15', receiptImage: '', notes: 'Spring collection order' },
  { id: 'p2', supplierId: '1', productName: 'Cotton Polo Shirt (Bulk)', quantity: 150, unitPrice: 12.0, totalPrice: 1800, date: '2026-03-28', receiptImage: '', notes: 'Restock — high demand' },
  { id: 'p3', supplierId: '1', productName: 'Linen Shirt (Bulk)', quantity: 100, unitPrice: 14.5, totalPrice: 1450, date: '2026-04-05', receiptImage: '', notes: '' },
  { id: 'p4', supplierId: '2', productName: 'Denim Jeans (Bulk)', quantity: 120, unitPrice: 22.0, totalPrice: 2640, date: '2026-02-20', receiptImage: '', notes: 'Premium denim batch' },
  { id: 'p5', supplierId: '2', productName: 'Chino Pants (Bulk)', quantity: 80, unitPrice: 18.0, totalPrice: 1440, date: '2026-03-10', receiptImage: '', notes: '' },
  { id: 'p6', supplierId: '3', productName: 'Leather Jacket (Bulk)', quantity: 50, unitPrice: 55.0, totalPrice: 2750, date: '2026-01-25', receiptImage: '', notes: 'Genuine leather — Grade A' },
  { id: 'p7', supplierId: '3', productName: 'Leather Belt (Bulk)', quantity: 300, unitPrice: 6.5, totalPrice: 1950, date: '2026-02-14', receiptImage: '', notes: 'Mixed brown & black' },
  { id: 'p8', supplierId: '3', productName: 'Wool Sweater (Bulk)', quantity: 100, unitPrice: 19.0, totalPrice: 1900, date: '2026-03-22', receiptImage: '', notes: 'Winter leftover — discounted' },
];

let _supplierListeners: (() => void)[] = [];
let _purchaseListeners: (() => void)[] = [];

function notifySuppliers() {
  _supplierListeners.forEach((l) => l());
}
function notifyPurchases() {
  _purchaseListeners.forEach((l) => l());
}

// ── Suppliers CRUD ──

export function getSuppliers() {
  return [..._suppliers];
}

export function addSupplier(s: Omit<Supplier, 'id' | 'totalSpent' | 'totalPurchases' | 'createdAt'>) {
  const newSupplier: Supplier = {
    ...s,
    id: `${Date.now()}`,
    totalSpent: 0,
    totalPurchases: 0,
    createdAt: new Date().toISOString().split('T')[0],
  };
  _suppliers = [..._suppliers, newSupplier];
  notifySuppliers();
  return newSupplier;
}

export function updateSupplier(updated: Supplier) {
  _suppliers = _suppliers.map((s) => (s.id === updated.id ? updated : s));
  notifySuppliers();
}

export function deleteSupplier(id: string) {
  _suppliers = _suppliers.filter((s) => s.id !== id);
  _purchases = _purchases.filter((p) => p.supplierId !== id);
  notifySuppliers();
  notifyPurchases();
}

export function subscribeSuppliers(listener: () => void) {
  _supplierListeners.push(listener);
  return () => {
    _supplierListeners = _supplierListeners.filter((l) => l !== listener);
  };
}

// ── Purchases CRUD ──

export function getPurchases() {
  return [..._purchases];
}

export function getPurchasesBySupplier(supplierId: string) {
  return _purchases.filter((p) => p.supplierId === supplierId);
}

export function addPurchase(p: Omit<Purchase, 'id'>) {
  const newPurchase: Purchase = { ...p, id: `${Date.now()}` };
  _purchases = [..._purchases, newPurchase];

  // Update supplier totals
  _suppliers = _suppliers.map((s) =>
    s.id === p.supplierId
      ? { ...s, totalSpent: s.totalSpent + p.totalPrice, totalPurchases: s.totalPurchases + 1 }
      : s
  );

  notifyPurchases();
  notifySuppliers();
  return newPurchase;
}

export function updatePurchase(updated: Purchase) {
  const oldPurchase = _purchases.find((p) => p.id === updated.id);
  if (oldPurchase) {
    _suppliers = _suppliers.map((s) =>
      s.id === updated.supplierId
        ? { ...s, totalSpent: s.totalSpent - oldPurchase.totalPrice + updated.totalPrice }
        : s
    );
  }
  _purchases = _purchases.map((p) => (p.id === updated.id ? updated : p));
  notifyPurchases();
  notifySuppliers();
}

export function deletePurchase(id: string) {
  const purchase = _purchases.find((p) => p.id === id);
  if (purchase) {
    _suppliers = _suppliers.map((s) =>
      s.id === purchase.supplierId
        ? { ...s, totalSpent: s.totalSpent - purchase.totalPrice, totalPurchases: s.totalPurchases - 1 }
        : s
    );
  }
  _purchases = _purchases.filter((p) => p.id !== id);
  notifyPurchases();
  notifySuppliers();
}

export function subscribePurchases(listener: () => void) {
  _purchaseListeners.push(listener);
  return () => {
    _purchaseListeners = _purchaseListeners.filter((l) => l !== listener);
  };
}
