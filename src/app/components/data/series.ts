import { getDbApi, toDateOnly } from './shared';

export type SerieItem = {
  size: string;
  quantity: number;
  sold: number;
};

export type Serie = {
  id: string;
  name: string;
  boxBarcode: string;
  productBarcode: string;
  productId?: string;
  category: string;
  image: string;
  costPrice: number;
  sellingPrice: number;
  unitPrice: number;
  boxQuantity: number;
  items: SerieItem[];
  supplierId?: string;
  createdAt: string;
};

const seedSeries: Serie[] = [
  {
    id: 'serie-1',
    name: 'Nike Air Max Serie',
    boxBarcode: 'BOX-NIKE-001',
    productBarcode: 'NIKE-AM-001',
    category: 'Shoes',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
    costPrice: 420,
    sellingPrice: 720,
    unitPrice: 120,
    boxQuantity: 1,
    items: [
      { size: '39', quantity: 1, sold: 0 },
      { size: '40', quantity: 1, sold: 0 },
      { size: '41', quantity: 1, sold: 0 },
      { size: '42', quantity: 1, sold: 0 },
      { size: '43', quantity: 1, sold: 0 },
      { size: '44', quantity: 1, sold: 0 },
    ],
    createdAt: '2026-04-01',
  },
  {
    id: 'serie-2',
    name: 'Adidas Stan Smith Serie',
    boxBarcode: 'BOX-ADIDAS-001',
    productBarcode: 'ADIDAS-SS-001',
    category: 'Shoes',
    image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=400&fit=crop',
    costPrice: 360,
    sellingPrice: 600,
    unitPrice: 100,
    boxQuantity: 1,
    items: [
      { size: '38', quantity: 1, sold: 0 },
      { size: '39', quantity: 1, sold: 0 },
      { size: '40', quantity: 1, sold: 1 },
      { size: '41', quantity: 1, sold: 0 },
      { size: '42', quantity: 1, sold: 0 },
      { size: '43', quantity: 1, sold: 0 },
    ],
    createdAt: '2026-04-05',
  },
];

let _series: Serie[] = [...seedSeries];
let _listeners: (() => void)[] = [];
let _initPromise: Promise<void> | null = null;

function cloneItems(items: SerieItem[]) {
  return items.map((item) => ({ ...item }));
}

function cloneSerie(serie: Serie): Serie {
  return {
    ...serie,
    items: cloneItems(serie.items),
  };
}

function notify() {
  _listeners.forEach((listener) => listener());
}

function normalizeSerieRow(row: Record<string, unknown>): Serie {
  const costPrice = Number(row.costPrice ?? 0);
  const sellingPrice = Number(row.sellingPrice ?? 0);
  const unitPrice = Number(row.unitPrice ?? 0);
  const boxQuantity = Number(row.boxQuantity ?? row.box_quantity ?? 1);

  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    boxBarcode: String(row.boxBarcode ?? ''),
    productBarcode: String(row.productBarcode ?? ''),
    productId: row.productId ? String(row.productId) : undefined,
    category: String(row.category ?? ''),
    image: String(row.image ?? ''),
    costPrice: Number.isFinite(costPrice) ? costPrice : 0,
    sellingPrice: Number.isFinite(sellingPrice) ? sellingPrice : 0,
    unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
    boxQuantity: Number.isFinite(boxQuantity) ? Math.max(0, Math.trunc(boxQuantity)) : 1,
    items: Array.isArray(row.items)
      ? row.items.map((item) => ({
          size: String((item as Record<string, unknown>).size ?? ''),
          quantity: Number((item as Record<string, unknown>).quantity ?? 0),
          sold: Number((item as Record<string, unknown>).sold ?? 0),
        }))
      : [],
    supplierId: row.supplierId ? String(row.supplierId) : undefined,
    createdAt: toDateOnly(row.createdAt),
  };
}

function toCreatePayload(serie: Omit<Serie, 'id' | 'createdAt'>) {
  return {
    name: serie.name,
    boxBarcode: serie.boxBarcode,
    productBarcode: serie.productBarcode,
    productId: serie.productId || undefined,
    category: serie.category,
    image: serie.image || '',
    costPrice: serie.costPrice,
    sellingPrice: serie.sellingPrice,
    unitPrice: serie.unitPrice,
    boxQuantity: serie.boxQuantity,
    supplierId: serie.supplierId || undefined,
    items: serie.items.map((item) => ({ ...item })),
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
  _series = rows.map((row) => normalizeSerieRow(row as Record<string, unknown>));
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

export function getSerieBoxQuantity(serie: Serie): number {
  return Math.max(0, Math.trunc(serie.boxQuantity));
}

export function findSeriesByProductBarcode(barcode: string): Serie[] {
  return _series
    .filter((serie) => serie.productBarcode === barcode && getSerieRemainingCount(serie) > 0)
    .map((serie) => cloneSerie(serie));
}

export function getSerieRemainingCount(serie: Serie): number {
  return serie.items.reduce((sum, item) => sum + Math.max(0, item.quantity - item.sold), 0);
}

export function getSerieTotalCount(serie: Serie): number {
  return serie.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function getSerieAvailableSizes(serie: Serie): string[] {
  return serie.items.filter((item) => item.quantity - item.sold > 0).map((item) => item.size);
}

export function getSizeRemainingCount(serie: Serie, size: string): number {
  const item = serie.items.find((entry) => entry.size === size);
  return item ? Math.max(0, item.quantity - item.sold) : 0;
}

export async function addSerie(serie: Omit<Serie, 'id' | 'createdAt'>) {
  await ensureInitialized();
  const db = getDbApi();

  if (!db) {
    const newSerie: Serie = {
      ...serie,
      items: cloneItems(serie.items),
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

  const created = normalizeSerieRow(row as Record<string, unknown>);
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

  const saved = normalizeSerieRow(row as Record<string, unknown>);
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

export function adjustSerieBoxQuantity(serieId: string, delta: number): boolean {
  const serie = _series.find((item) => item.id === serieId);
  if (!serie) {
    return false;
  }

  const nextQuantity = serie.boxQuantity + Math.trunc(delta);
  if (nextQuantity < 0) {
    return false;
  }

  serie.boxQuantity = nextQuantity;
  notify();
  return true;
}

export function sellSerieItem(serieId: string, size: string, quantity = 1): boolean {
  const serie = _series.find((item) => item.id === serieId);
  if (!serie) {
    return false;
  }

  const item = serie.items.find((entry) => entry.size === size && entry.quantity - entry.sold > 0);
  if (!item) {
    return false;
  }

  item.sold = Math.min(item.quantity, item.sold + Math.max(1, Math.trunc(quantity)));
  notify();
  return true;
}

export function subscribeSeries(listener: () => void) {
  _listeners.push(listener);
  listener();
  return () => {
    _listeners = _listeners.filter((current) => current !== listener);
  };
}
