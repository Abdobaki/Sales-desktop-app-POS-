import { getDbApi, toCents, toDateOnly, toDollars } from './shared';
import { getProducts, updateProduct } from './products';

export type Purchase = {
  id: string;
  supplierId: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  date: string;
  receiptImage: string;
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

const seedSuppliers: Supplier[] = [
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

const seedPurchases: Purchase[] = [
  { id: 'p1', supplierId: '1', productName: 'Classic White T-Shirt (Bulk)', quantity: 200, unitPrice: 8.5, totalPrice: 1700, date: '2026-03-15', receiptImage: '', notes: 'Spring collection order' },
  { id: 'p2', supplierId: '1', productName: 'Cotton Polo Shirt (Bulk)', quantity: 150, unitPrice: 12.0, totalPrice: 1800, date: '2026-03-28', receiptImage: '', notes: 'Restock - high demand' },
  { id: 'p3', supplierId: '1', productName: 'Linen Shirt (Bulk)', quantity: 100, unitPrice: 14.5, totalPrice: 1450, date: '2026-04-05', receiptImage: '', notes: '' },
  { id: 'p4', supplierId: '2', productName: 'Denim Jeans (Bulk)', quantity: 120, unitPrice: 22.0, totalPrice: 2640, date: '2026-02-20', receiptImage: '', notes: 'Premium denim batch' },
  { id: 'p5', supplierId: '2', productName: 'Chino Pants (Bulk)', quantity: 80, unitPrice: 18.0, totalPrice: 1440, date: '2026-03-10', receiptImage: '', notes: '' },
  { id: 'p6', supplierId: '3', productName: 'Leather Jacket (Bulk)', quantity: 50, unitPrice: 55.0, totalPrice: 2750, date: '2026-01-25', receiptImage: '', notes: 'Genuine leather - Grade A' },
  { id: 'p7', supplierId: '3', productName: 'Leather Belt (Bulk)', quantity: 300, unitPrice: 6.5, totalPrice: 1950, date: '2026-02-14', receiptImage: '', notes: 'Mixed brown & black' },
  { id: 'p8', supplierId: '3', productName: 'Wool Sweater (Bulk)', quantity: 100, unitPrice: 19.0, totalPrice: 1900, date: '2026-03-22', receiptImage: '', notes: 'Winter leftover - discounted' },
];

let _suppliers: Supplier[] = [...seedSuppliers];
let _purchases: Purchase[] = [...seedPurchases];
let _supplierListeners: (() => void)[] = [];
let _purchaseListeners: (() => void)[] = [];
let _initPromise: Promise<void> | null = null;

function notifySuppliers() {
  _supplierListeners.forEach((listener) => listener());
}

function notifyPurchases() {
  _purchaseListeners.forEach((listener) => listener());
}

function parsePurchaseRow(row: Record<string, unknown>): Purchase {
  const quantity = Number(row.quantity ?? 0);
  const unitPrice = toDollars(row.unit_cost_cents);

  return {
    id: String(row.id),
    supplierId: String(row.supplier_id ?? ''),
    productId: row.product_id ? String(row.product_id) : undefined,
    productName: String(row.product_name_snapshot ?? ''),
    quantity,
    unitPrice,
    totalPrice: toDollars(row.total_cost_cents ?? toCents(quantity * unitPrice)),
    date: toDateOnly(row.purchase_date),
    receiptImage: String(row.receipt_data_url ?? ''),
    notes: String(row.notes ?? ''),
  };
}

async function changeProductStock(productId: string | undefined, quantityDelta: number) {
  if (!productId || quantityDelta === 0) {
    return;
  }

  const product = getProducts().find((item) => item.id === productId);
  if (!product) {
    return;
  }

  const nextStock = Math.max(0, product.stock + quantityDelta);
  await updateProduct({
    ...product,
    stock: nextStock,
  });
}

async function applyStockAdjustmentOnCreate(purchase: Omit<Purchase, 'id'>) {
  await changeProductStock(purchase.productId, purchase.quantity);
}

async function applyStockAdjustmentOnUpdate(previous: Purchase | undefined, updated: Purchase) {
  if (!previous) {
    return;
  }

  if (previous.productId && updated.productId && previous.productId === updated.productId) {
    await changeProductStock(updated.productId, updated.quantity - previous.quantity);
    return;
  }

  if (previous.productId) {
    await changeProductStock(previous.productId, -previous.quantity);
  }

  if (updated.productId) {
    await changeProductStock(updated.productId, updated.quantity);
  }
}

async function applyStockAdjustmentOnDelete(purchase: Purchase | undefined) {
  if (!purchase?.productId) {
    return;
  }

  await changeProductStock(purchase.productId, -purchase.quantity);
}

function parseSupplierBase(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    company: String(row.company ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    address: String(row.address ?? ''),
    createdAt: toDateOnly(row.created_at),
  };
}

function composeSuppliers(rows: Record<string, unknown>[], purchases: Purchase[]): Supplier[] {
  const totals = new Map<string, { totalSpent: number; totalPurchases: number }>();

  for (const purchase of purchases) {
    const current = totals.get(purchase.supplierId) ?? { totalSpent: 0, totalPurchases: 0 };
    current.totalSpent += purchase.totalPrice;
    current.totalPurchases += 1;
    totals.set(purchase.supplierId, current);
  }

  return rows.map((row) => {
    const base = parseSupplierBase(row);
    const total = totals.get(base.id);

    return {
      ...base,
      totalSpent: total?.totalSpent ?? 0,
      totalPurchases: total?.totalPurchases ?? 0,
    };
  });
}

function rebuildSuppliersFromCachedRows() {
  _suppliers = composeSuppliers(
    _suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      company: supplier.company,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      created_at: supplier.createdAt,
    })),
    _purchases
  );
}

async function seedSuppliersIfEmpty() {
  const db = getDbApi();
  if (!db) {
    return;
  }

  const existing = await db.suppliers.list({ limit: 1 });
  if (existing.length > 0) {
    return;
  }

  for (const supplier of seedSuppliers) {
    await db.suppliers.create({
      id: supplier.id,
      name: supplier.name,
      company: supplier.company,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      is_active: 1,
    });
  }
}

async function seedPurchasesIfEmpty() {
  const db = getDbApi();
  if (!db) {
    return;
  }

  const existing = await db.supplier_purchases.list({ limit: 1 });
  if (existing.length > 0) {
    return;
  }

  for (const purchase of seedPurchases) {
    await db.supplier_purchases.create({
      id: purchase.id,
      supplier_id: purchase.supplierId,
      product_name_snapshot: purchase.productName,
      product_barcode_snapshot: null,
      quantity: purchase.quantity,
      unit_cost_cents: toCents(purchase.unitPrice),
      total_cost_cents: toCents(purchase.totalPrice),
      purchase_date: purchase.date,
      notes: purchase.notes,
      receipt_data_url: purchase.receiptImage || null,
    });
  }
}

async function loadDataFromDb() {
  const db = getDbApi();
  if (!db) {
    return;
  }

  await seedSuppliersIfEmpty();
  await seedPurchasesIfEmpty();

  const [supplierRows, purchaseRows] = await Promise.all([
    db.suppliers.list({ orderBy: 'name' }),
    db.supplier_purchases.list({ orderBy: 'purchase_date', orderDirection: 'DESC' }),
  ]);

  _purchases = purchaseRows.map((row) => parsePurchaseRow(row));
  _suppliers = composeSuppliers(supplierRows, _purchases);

  notifySuppliers();
  notifyPurchases();
}

function ensureInitialized() {
  if (_initPromise) {
    return _initPromise;
  }

  _initPromise = loadDataFromDb().catch((error) => {
    console.error('[suppliers] Failed to initialize from DB:', error);
  });

  return _initPromise;
}

void ensureInitialized();

export function getSuppliers() {
  return [..._suppliers];
}

export async function addSupplier(s: Omit<Supplier, 'id' | 'totalSpent' | 'totalPurchases' | 'createdAt'>) {
  await ensureInitialized();
  const db = getDbApi();

  if (!db) {
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

  const row = await db.suppliers.create({
    name: s.name,
    company: s.company,
    phone: s.phone,
    email: s.email,
    address: s.address,
    is_active: 1,
  });

  await loadDataFromDb();
  const createdId = row?.id ? String(row.id) : '';
  return _suppliers.find((supplier) => supplier.id === createdId) ?? {
    id: createdId || `${Date.now()}`,
    name: s.name,
    company: s.company,
    phone: s.phone,
    email: s.email,
    address: s.address,
    totalSpent: 0,
    totalPurchases: 0,
    createdAt: new Date().toISOString().split('T')[0],
  };
}

export async function updateSupplier(updated: Supplier) {
  await ensureInitialized();
  const db = getDbApi();

  if (!db) {
    _suppliers = _suppliers.map((supplier) =>
      supplier.id === updated.id
        ? {
            ...supplier,
            name: updated.name,
            company: updated.company,
            phone: updated.phone,
            email: updated.email,
            address: updated.address,
          }
        : supplier
    );
    notifySuppliers();
    return;
  }

  await db.suppliers.update({
    id: updated.id,
    name: updated.name,
    company: updated.company,
    phone: updated.phone,
    email: updated.email,
    address: updated.address,
    is_active: 1,
  });

  await loadDataFromDb();
}

export async function deleteSupplier(id: string) {
  await ensureInitialized();
  const db = getDbApi();

  if (db) {
    await db.suppliers.delete(id);
    await loadDataFromDb();
    return;
  }

  _suppliers = _suppliers.filter((supplier) => supplier.id !== id);
  _purchases = _purchases.filter((purchase) => purchase.supplierId !== id);
  notifySuppliers();
  notifyPurchases();
}

export function subscribeSuppliers(listener: () => void) {
  _supplierListeners.push(listener);
  return () => {
    _supplierListeners = _supplierListeners.filter((l) => l !== listener);
  };
}

export function getPurchases() {
  return [..._purchases];
}

export function getPurchasesBySupplier(supplierId: string) {
  return _purchases.filter((purchase) => purchase.supplierId === supplierId);
}

export async function addPurchase(p: Omit<Purchase, 'id'>) {
  await ensureInitialized();
  const db = getDbApi();

  if (!db) {
    const newPurchase: Purchase = { ...p, id: `${Date.now()}` };
    _purchases = [..._purchases, newPurchase];
    await applyStockAdjustmentOnCreate(p);
    rebuildSuppliersFromCachedRows();
    notifyPurchases();
    notifySuppliers();
    return newPurchase;
  }

  const row = await db.supplier_purchases.create({
    supplier_id: p.supplierId,
    product_id: p.productId || null,
    product_name_snapshot: p.productName,
    product_barcode_snapshot: null,
    quantity: p.quantity,
    unit_cost_cents: toCents(p.unitPrice),
    total_cost_cents: toCents(p.totalPrice),
    purchase_date: p.date,
    notes: p.notes,
    receipt_data_url: p.receiptImage || null,
  });

  await applyStockAdjustmentOnCreate(p);
  await loadDataFromDb();
  const createdId = row?.id ? String(row.id) : '';
  return _purchases.find((purchase) => purchase.id === createdId) ?? {
    ...p,
    id: createdId || `${Date.now()}`,
  };
}

export async function updatePurchase(updated: Purchase) {
  await ensureInitialized();
  const db = getDbApi();
  const previous = _purchases.find((purchase) => purchase.id === updated.id);

  if (!db) {
    _purchases = _purchases.map((purchase) => (purchase.id === updated.id ? updated : purchase));
    await applyStockAdjustmentOnUpdate(previous, updated);
    rebuildSuppliersFromCachedRows();
    notifyPurchases();
    notifySuppliers();
    return;
  }

  await db.supplier_purchases.update({
    id: updated.id,
    supplier_id: updated.supplierId,
    product_id: updated.productId || null,
    product_name_snapshot: updated.productName,
    quantity: updated.quantity,
    unit_cost_cents: toCents(updated.unitPrice),
    total_cost_cents: toCents(updated.totalPrice),
    purchase_date: updated.date,
    notes: updated.notes,
    receipt_data_url: updated.receiptImage || null,
  });

  await applyStockAdjustmentOnUpdate(previous, updated);
  await loadDataFromDb();
}

export async function deletePurchase(id: string) {
  await ensureInitialized();
  const db = getDbApi();
  const previous = _purchases.find((purchase) => purchase.id === id);

  if (db) {
    await db.supplier_purchases.delete(id);
    await applyStockAdjustmentOnDelete(previous);
    await loadDataFromDb();
    return;
  }

  _purchases = _purchases.filter((purchase) => purchase.id !== id);
  await applyStockAdjustmentOnDelete(previous);
  rebuildSuppliersFromCachedRows();
  notifyPurchases();
  notifySuppliers();
}

export function subscribePurchases(listener: () => void) {
  _purchaseListeners.push(listener);
  return () => {
    _purchaseListeners = _purchaseListeners.filter((l) => l !== listener);
  };
}
