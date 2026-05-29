import { getDbApi, toCents, toDollars } from './shared';

export type Product = {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  category: string;
  image: string;
  barcode: string;
  sku: string;
  variants: string;
  stock: number;
  supplierId?: string;
  boxOnly?: boolean;
};

let _products: Product[] = [];
let _listeners: (() => void)[] = [];
let _initPromise: Promise<void> | null = null;

// Keep backward-compatible export used by POS/Scanner
export const productCatalog = _products;

function syncProductCatalog() {
  productCatalog.length = 0;
  productCatalog.push(..._products);
}

function notifyProducts() {
  syncProductCatalog();
  _listeners.forEach((listener) => listener());
}

function parseProductRow(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    price: toDollars(row.sale_price_cents),
    costPrice: toDollars(row.cost_price_cents),
    category: String(row.category ?? ''),
    image: String(row.image_url ?? ''),
    barcode: String(row.barcode ?? ''),
    sku: String(row.sku ?? ''),
    variants: String(row.variants ?? '-'),
    stock: Number(row.stock_qty ?? 0),
    supplierId: row.supplier_id ? String(row.supplier_id) : undefined,
    boxOnly: row.box_only === 1 || row.box_only === true || row.boxOnly === true || false,
  };
}

function toCreatePayload(product: Omit<Product, 'id'>) {
  return {
    name: product.name,
    category: product.category,
    sku: product.sku,
    barcode: product.barcode || null,
    variants: product.variants || '-',
    image_url: product.image || null,
    cost_price_cents: toCents(product.costPrice),
    sale_price_cents: toCents(product.price),
    stock_qty: Math.max(0, Math.floor(product.stock)),
    supplier_id: product.supplierId || null,
    is_active: 1,
    box_only: product.boxOnly ? 1 : 0,
  };
}

function toUpdatePayload(product: Product) {
  return {
    id: product.id,
    ...toCreatePayload(product),
  };
}

async function loadProductsFromDb() {
  const db = getDbApi();
  if (!db) {
    return;
  }

  const rows = await db.products.list({ orderBy: 'name' });
  _products = rows.map((row) => parseProductRow(row));
  notifyProducts();
}

function ensureInitialized() {
  if (_initPromise) {
    return _initPromise;
  }

  _initPromise = loadProductsFromDb().catch((error) => {
    console.error('[products] Failed to initialize from DB:', error);
  });

  return _initPromise;
}

void ensureInitialized();

export async function refreshProducts() {
  await loadProductsFromDb();
}

export function getProducts() {
  return [..._products];
}

export async function addProduct(p: Omit<Product, 'id'>) {
  await ensureInitialized();
  const db = getDbApi();

  if (!db) {
    const newProduct: Product = { ...p, id: `${Date.now()}` };
    _products = [..._products, newProduct];
    notifyProducts();
    return newProduct;
  }

  const row = await db.products.create(toCreatePayload(p));
  if (!row) {
    throw new Error('Failed to create product');
  }

  const created = parseProductRow(row);
  _products = [..._products, created];
  notifyProducts();
  return created;
}

export async function updateProduct(updated: Product) {
  await ensureInitialized();
  const db = getDbApi();

  if (!db) {
    _products = _products.map((p) => (p.id === updated.id ? updated : p));
    notifyProducts();
    return updated;
  }

  const row = await db.products.update(toUpdatePayload(updated));
  if (!row) {
    throw new Error('Failed to update product');
  }

  const saved = parseProductRow(row);
  _products = _products.map((p) => (p.id === saved.id ? saved : p));
  notifyProducts();
  return saved;
}

export async function deleteProduct(id: string) {
  await ensureInitialized();
  const db = getDbApi();

  if (db) {
    await db.products.delete(id);
  }

  _products = _products.filter((p) => p.id !== id);
  notifyProducts();
}

export function subscribeProducts(listener: () => void) {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}
