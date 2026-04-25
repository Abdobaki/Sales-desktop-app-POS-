export type SerieItem = {
  size: string;      // e.g., "39", "40", "41"
  quantity: number;  // how many of this size are in the box
  sold: number;      // how many of this size have been sold individually
};

export type Serie = {
  id: string;
  name: string;            // e.g., "Nike Air Max Serie"
  boxBarcode: string;      // the barcode on the box itself
  productBarcode: string;  // the shared barcode of items inside
  productId?: string;      // optional link to a product in catalog
  category: string;        // e.g., "Shoes"
  image: string;
  costPrice: number;       // buying price for the whole box
  sellingPrice: number;    // selling price for the whole box
  unitPrice: number;       // selling price per individual item
  items: SerieItem[];      // individual items with their sizes
  supplierId?: string;
  createdAt: string;
};

let _series: Serie[] = [
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

let _listeners: (() => void)[] = [];

function notify() {
  _listeners.forEach((l) => l());
}

// ── Read ──

export function getSeries(): Serie[] {
  return _series.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) }));
}

export function getSerieById(id: string): Serie | undefined {
  const s = _series.find((s) => s.id === id);
  if (!s) return undefined;
  return { ...s, items: s.items.map((i) => ({ ...i })) };
}

export function findSerieByBoxBarcode(barcode: string): Serie | undefined {
  const s = _series.find((s) => s.boxBarcode === barcode);
  if (!s) return undefined;
  return { ...s, items: s.items.map((i) => ({ ...i })) };
}

export function findSeriesByProductBarcode(barcode: string): Serie[] {
  return _series
    .filter((s) => s.productBarcode === barcode && s.items.some((i) => !i.sold))
    .map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) }));
}

// ── Computed helpers ──

export function getSerieRemainingCount(serie: Serie): number {
  return serie.items.reduce((sum, i) => sum + (i.quantity - i.sold), 0);
}

export function getSerieTotalCount(serie: Serie): number {
  return serie.items.reduce((sum, i) => sum + i.quantity, 0);
}

export function getSerieAvailableSizes(serie: Serie): string[] {
  return serie.items.filter((i) => i.quantity - i.sold > 0).map((i) => i.size);
}

export function getSizeRemainingCount(serie: Serie, size: string): number {
  const item = serie.items.find((i) => i.size === size);
  return item ? item.quantity - item.sold : 0;
}

// ── Create ──

export function addSerie(s: Omit<Serie, 'id' | 'createdAt'>): Serie {
  const newSerie: Serie = {
    ...s,
    items: s.items.map((i) => ({ ...i })),
    id: `serie-${Date.now()}`,
    createdAt: new Date().toISOString().split('T')[0],
  };
  _series = [..._series, newSerie];
  notify();
  return newSerie;
}

// ── Update ──

export function updateSerie(updated: Serie) {
  _series = _series.map((s) => (s.id === updated.id ? { ...updated, items: updated.items.map((i) => ({ ...i })) } : s));
  notify();
}

// ── Delete ──

export function deleteSerie(id: string) {
  _series = _series.filter((s) => s.id !== id);
  notify();
}

// ── Sell one item from a serie ──

export function sellSerieItem(serieId: string, size: string): boolean {
  const serie = _series.find((s) => s.id === serieId);
  if (!serie) return false;

  const item = serie.items.find((i) => i.size === size && i.quantity - i.sold > 0);
  if (!item) return false;

  item.sold += 1;

  // Check if all items are now sold → auto-remove serie
  const remaining = serie.items.reduce((sum, i) => sum + (i.quantity - i.sold), 0);
  if (remaining === 0) {
    _series = _series.filter((s) => s.id !== serieId);
  }

  notify();
  return true;
}

// ── Unsell (undo) — useful if checkout is cancelled ──

export function unsellSerieItem(serieId: string, size: string): boolean {
  const serie = _series.find((s) => s.id === serieId);
  if (!serie) return false;

  const item = serie.items.find((i) => i.size === size && i.sold > 0);
  if (!item) return false;

  item.sold -= 1;
  notify();
  return true;
}

// ── Subscribe ──

export function subscribeSeries(listener: () => void) {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}
