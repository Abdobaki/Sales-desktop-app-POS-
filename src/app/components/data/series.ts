import { getDbApi, toDateOnly } from './shared';
import { getProducts, type Product } from './products';

export type SerieComponent = {
  productId: string;
  quantity: number;
  label?: string;
};

export type SerieLegacyItem = {
  size: string;
  quantity: number;
  sold: number;
};

export type Serie = {
  id: string;
  name: string;
  boxBarcode: string;
  category: string;
  image: string;
  costPrice: number;
  sellingPrice: number;
  components: SerieComponent[];
  legacyItems?: SerieLegacyItem[];
  supplierId?: string;
  createdAt: string;
};

const seedSeries: Serie[] = [];

let _series: Serie[] = [...seedSeries];
let _listeners: (() => void)[] = [];
let _initPromise: Promise<void> | null = null;

function cloneComponents(components: SerieComponent[]) {
  return components.map((component) => ({ ...component }));
}

function cloneLegacyItems(items?: SerieLegacyItem[]) {
  return items ? items.map((item) => ({ ...item })) : undefined;
}

function cloneSerie(serie: Serie): Serie {
  return {
    ...serie,
    components: cloneComponents(serie.components),
    legacyItems: cloneLegacyItems(serie.legacyItems),
  };
}

function notify() {
  _listeners.forEach((listener) => listener());
}

function parsePositiveQuantity(value: unknown) {
  const quantity = Math.trunc(Number(value ?? 0));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function normalizeSerieRow(row: Record<string, unknown>, products: Product[]): Serie {
  const productLookup = new Map<string, Product>();

  for (const product of products) {
    productLookup.set(product.id, product);
    productLookup.set(product.barcode, product);
    productLookup.set(product.sku.toLowerCase(), product);
    productLookup.set(product.name.toLowerCase(), product);
  }

  const fallbackProductId = String(row.productId ?? row.product_id ?? '').trim();
  const rawComponents = Array.isArray(row.components) ? row.components : Array.isArray(row.items) ? row.items : [];
  const rawLegacyItems = Array.isArray(row.legacyItems) ? row.legacyItems : [];
  const components: SerieComponent[] = [];
  const legacyItems: SerieLegacyItem[] = [];

  for (const rawItem of rawComponents) {
    const item = rawItem as Record<string, unknown>;
    const explicitProductId = String(item.productId ?? item.product_id ?? '').trim();
    const label = String(item.size ?? item.label ?? '').trim();
    const quantity = parsePositiveQuantity(item.quantity);
    const resolvedProduct =
      productLookup.get(explicitProductId) ??
      productLookup.get(label) ??
      productLookup.get(label.toLowerCase()) ??
      (fallbackProductId ? productLookup.get(fallbackProductId) : undefined);
    const productId = explicitProductId || resolvedProduct?.id || fallbackProductId || '';

    if (productId) {
      components.push({
        productId,
        quantity,
        label: label || resolvedProduct?.name || resolvedProduct?.sku || undefined,
      });
      continue;
    }

    legacyItems.push({
      size: label,
      quantity,
      sold: Math.max(0, Math.trunc(Number(item.sold ?? 0))),
    });
  }

  for (const rawItem of rawLegacyItems) {
    const item = rawItem as Record<string, unknown>;
    legacyItems.push({
      size: String(item.size ?? ''),
      quantity: parsePositiveQuantity(item.quantity),
      sold: Math.max(0, Math.trunc(Number(item.sold ?? 0))),
    });
  }

  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    boxBarcode: String(row.boxBarcode ?? row.box_barcode ?? ''),
    category: String(row.category ?? ''),
    image: String(row.image ?? row.image_url ?? ''),
    costPrice: Number.isFinite(Number(row.costPrice)) ? Number(row.costPrice) : Number(row.cost_price_cents ?? 0) / 100,
    sellingPrice: Number.isFinite(Number(row.sellingPrice)) ? Number(row.sellingPrice) : Number(row.selling_price_cents ?? 0) / 100,
    components,
    legacyItems: legacyItems.length > 0 ? legacyItems : undefined,
    supplierId: row.supplierId ? String(row.supplierId) : row.supplier_id ? String(row.supplier_id) : undefined,
    createdAt: toDateOnly(row.createdAt ?? row.created_at),
  };
}

function toCreatePayload(serie: Omit<Serie, 'id' | 'createdAt'>) {
  return {
    name: serie.name,
    boxBarcode: serie.boxBarcode,
    category: serie.category,
    image: serie.image || '',
    costPrice: serie.costPrice,
    sellingPrice: serie.sellingPrice,
    supplierId: serie.supplierId || undefined,
    components: serie.components.map((component) => ({ ...component })),
  };
}

function toUpdatePayload(serie: Serie) {
  return {
    id: serie.id,
    ...toCreatePayload(serie),
  };
}

async function loadSeriesFromDb() {
  const db = getDbApi();
  if (!db) {
    return;
  }

  const existing = await db.series.list({ limit: 1 });
  if (existing.length === 0) {
    for (const serie of seedSeries) {
      await db.series.create({ id: serie.id, ...toCreatePayload(serie) });
    }
  }

  const rows = await db.series.list({ orderBy: 'name' });
  _series = rows.map((row) => normalizeSerieRow(row as Record<string, unknown>, getProducts()));
  notify();
}

function ensureInitialized() {
  if (_initPromise) {
    return _initPromise;
  }

  _initPromise = loadSeriesFromDb().catch((error) => {
    console.error('[series] Failed to initialize from DB:', error);
  });

  return _initPromise;
}

void ensureInitialized();

export async function refreshSeries() {
  const db = getDbApi();
  if (!db) {
    notify();
    return;
  }

  await loadSeriesFromDb();
}

export function getSeries(): Serie[] {
  return _series.map((serie) => cloneSerie(serie));
}

export function getSerieById(id: string): Serie | undefined {
  const serie = _series.find((item) => item.id === id);
  return serie ? cloneSerie(serie) : undefined;
}

export function findSerieByBoxBarcode(barcode: string): Serie | undefined {
  const serie = _series.find((item) => item.boxBarcode === barcode);
  return serie ? cloneSerie(serie) : undefined;
}

function getProductStock(productId: string, products: Product[]) {
  const product = products.find((item) => item.id === productId);
  return Math.max(0, Math.trunc(product?.stock ?? 0));
}

export function getSerieBoxQuantity(serie: Serie): number {
  if (!serie.components.length) {
    return 0;
  }

  const products = getProducts();
  let available = Number.POSITIVE_INFINITY;

  for (const component of serie.components) {
    const quantity = Math.max(1, Math.trunc(component.quantity));
    const stock = getProductStock(component.productId, products);
    const possibleBoxes = Math.floor(stock / quantity);
    available = Math.min(available, possibleBoxes);
  }

  return Number.isFinite(available) ? Math.max(0, available) : 0;
}

export function getSerieTotalCount(serie: Serie): number {
  return serie.components.reduce((sum, component) => sum + Math.max(1, Math.trunc(component.quantity)), 0);
}

export function getSerieAvailableSizes(serie: Serie): string[] {
  return serie.components.map((component) => component.label || component.productId);
}

export function getSerieRemainingCount(serie: Serie): number {
  return getSerieBoxQuantity(serie);
}

export function getSizeRemainingCount(serie: Serie, componentId: string): number {
  const component = serie.components.find((item) => item.productId === componentId || item.label === componentId);
  if (!component) {
    return 0;
  }

  const products = getProducts();
  const stock = getProductStock(component.productId, products);
  return Math.max(0, stock - Math.max(1, Math.trunc(component.quantity)));
}

export async function addSerie(serie: Omit<Serie, 'id' | 'createdAt'>) {
  await ensureInitialized();
  const db = getDbApi();

  if (!db) {
    const newSerie: Serie = {
      ...serie,
      components: cloneComponents(serie.components),
      id: `serie-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    _series = [..._series, newSerie];
    notify();
    return cloneSerie(newSerie);
  }

  const row = await db.series.create(toCreatePayload(serie));
  if (!row) {
    throw new Error('Failed to create serie');
  }

  const created = normalizeSerieRow(row as Record<string, unknown>, getProducts());
  _series = [..._series, created];
  notify();
  return cloneSerie(created);
}

export async function updateSerie(updated: Serie) {
  await ensureInitialized();
  const db = getDbApi();

  if (!db) {
    _series = _series.map((serie) => (serie.id === updated.id ? cloneSerie(updated) : serie));
    notify();
    return cloneSerie(updated);
  }

  const row = await db.series.update(toUpdatePayload(updated));
  if (!row) {
    throw new Error('Failed to update serie');
  }

  const saved = normalizeSerieRow(row as Record<string, unknown>, getProducts());
  _series = _series.map((serie) => (serie.id === saved.id ? saved : serie));
  notify();
  return cloneSerie(saved);
}

export async function deleteSerie(id: string) {
  await ensureInitialized();
  const db = getDbApi();

  if (db) {
    await db.series.delete(id);
  }

  _series = _series.filter((serie) => serie.id !== id);
  notify();
}

export function adjustSerieBoxQuantity(_serieId: string, _delta: number): boolean {
  return false;
}

export function sellSerieItem(_serieId: string, _size: string, _quantity = 1): boolean {
  return false;
}

export function findSeriesByProductBarcode(barcode: string): Serie[] {
  const products = getProducts();
  const normalized = barcode.toLowerCase();
  const matchingProductIds = new Set(
    products
      .filter((product) => product.barcode === barcode || product.sku.toLowerCase() === normalized)
      .map((product) => product.id)
  );

  if (matchingProductIds.size === 0) {
    return [];
  }

  return _series
    .filter((serie) => serie.components.some((component) => matchingProductIds.has(component.productId)))
    .map((serie) => cloneSerie(serie));
}

export function subscribeSeries(listener: () => void) {
  _listeners.push(listener);
  listener();
  return () => {
    _listeners = _listeners.filter((current) => current !== listener);
  };
}
