import { getDbApi, toCents } from './shared';
import { getProducts, updateProduct, refreshProducts, type Product } from './products';
import { getSeries, sellSerieItem, refreshSeries, getSerieBoxQuantity, adjustSerieBoxQuantity, type Serie } from './series';
import { refreshCustomers } from './customers';

export type SaleCartItem =
  | { type: 'product'; id: string; name: string; image: string; price: number; quantity: number }
  | { type: 'serie'; id: string; serieId: string; name: string; image: string; price: number; quantity: number }
  | { type: 'serie-item'; id: string; serieId: string; serieName: string; size: string; name: string; image: string; price: number; quantity: number };

export type SaleCheckoutContext = {
  sourceView: 'pos' | 'scanner';
  customerId?: string | null;
  paymentMethodCode?: string | null;
  items: SaleCartItem[];
};

export type SaleCheckoutResult = {
  orderId: string;
  receiptNumber: string;
  soldAt: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  sourceView: string;
  customerId: string | null;
  paymentMethodCode: string | null;
};

function generateLocalReceiptNumber() {
  return `REC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function getProductById(id: string): Product | undefined {
  return getProducts().find((product) => product.id === id);
}

function getSerieById(id: string): Serie | undefined {
  return getSeries().find((serie) => serie.id === id);
}

async function applyLocalSale(items: SaleCartItem[]) {
  const resolvedItems: Array<
    | { type: 'product'; product: Product; quantity: number }
    | { type: 'serie'; serie: Serie }
    | { type: 'serie-item'; serie: Serie; size: string; quantity: number }
  > = [];

  for (const item of items) {
    if (item.type === 'product') {
      const product = getProductById(item.id);
      if (!product) {
        throw new Error(`Product not found: ${item.id}`);
      }

      if (item.quantity > product.stock) {
        throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock}`);
      }

      resolvedItems.push({ type: 'product', product, quantity: item.quantity });
      continue;
    }

    const serie = getSerieById(item.serieId);
    if (!serie) {
      throw new Error(`Series not found: ${item.serieId}`);
    }

    if (item.type === 'serie') {
      if (item.quantity !== 1) {
        throw new Error('Series box sales can only have quantity 1.');
      }

      if (getSerieBoxQuantity(serie) <= 0) {
        throw new Error(`No boxes left for series: ${serie.name}`);
      }

      resolvedItems.push({ type: 'serie', serie });
      continue;
    }

    const sizeItem = serie.items.find((entry) => entry.size === item.size);
    if (!sizeItem) {
      throw new Error(`Size not found in ${serie.name}: ${item.size}`);
    }

    const remaining = Math.max(0, sizeItem.quantity - sizeItem.sold);
    if (item.quantity > remaining) {
      throw new Error(`Not enough stock for ${serie.name} size ${item.size}. Available: ${remaining}`);
    }

    resolvedItems.push({ type: 'serie-item', serie, size: item.size, quantity: item.quantity });
  }

  for (const resolved of resolvedItems) {
    if (resolved.type === 'product') {
      await updateProduct({
        ...resolved.product,
        stock: resolved.product.stock - resolved.quantity,
      });
      continue;
    }

    if (resolved.type === 'serie') {
      if (!adjustSerieBoxQuantity(resolved.serie.id, -1)) {
        throw new Error(`No boxes left for series: ${resolved.serie.name}`);
      }
      continue;
    }

    sellSerieItem(resolved.serie.id, resolved.size, resolved.quantity);
  }
}

export async function checkoutSale(context: SaleCheckoutContext): Promise<SaleCheckoutResult> {
  const items = Array.isArray(context.items) ? context.items : [];
  if (items.length === 0) {
    throw new Error('Cart is empty.');
  }

  const subtotalCents = items.reduce((sum, item) => sum + toCents(item.price * item.quantity), 0);
  const soldAt = new Date().toISOString();
  const receiptNumber = generateLocalReceiptNumber();

  const db = getDbApi();
  if (db?.sales?.checkout) {
    const result = (await db.sales.checkout({
      ...context,
      items,
      soldAt,
    })) as SaleCheckoutResult;

    try {
      await Promise.all([refreshProducts(), refreshCustomers(), refreshSeries()]);
    } catch (error) {
      console.error('[sales] Failed to refresh local data after checkout:', error);
    }

    return result;
  }

  await applyLocalSale(items);

  return {
    orderId: `local-${Date.now().toString(36)}`,
    receiptNumber,
    soldAt,
    subtotalCents,
    discountCents: 0,
    taxCents: 0,
    totalCents: subtotalCents,
    sourceView: context.sourceView,
    customerId: context.customerId ?? null,
    paymentMethodCode: context.paymentMethodCode ?? null,
  };
}
