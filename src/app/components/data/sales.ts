import { getDbApi, toCents } from './shared';
import { getProducts, updateProduct, refreshProducts, type Product } from './products';
import { getSeries, refreshSeries, type Serie, type SerieComponent } from './series';
import { refreshCustomers } from './customers';

export type SaleCartItem =
  | { type: 'product'; id: string; name: string; image: string; price: number; quantity: number }
  | { type: 'serie'; id: string; serieId: string; name: string; image: string; price: number; quantity: number; components: SerieComponent[] };

export type SaleCheckoutContext = {
  sourceView: 'pos' | 'scanner';
  customerId?: string | null;
  paymentMethodCode?: string | null;
  items: SaleCartItem[];
  partialPayment?: boolean;
  paidAmountCents?: number;
  debtNotes?: string;
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
  debtId: string | null;
  paidAmountCents: number;
  remainingCents: number;
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

function normalizeBoxComponents(serie: Serie, components: SerieComponent[] | undefined) {
  const source = Array.isArray(components) && components.length > 0 ? components : serie.components;
  return source
    .map((component) => ({
      productId: String(component.productId ?? '').trim(),
      quantity: Math.max(1, Math.trunc(Number(component.quantity ?? 1))),
      label: String(component.label ?? '').trim(),
    }))
    .filter((component) => component.productId.length > 0);
}

async function applyLocalSale(items: SaleCartItem[]) {
  const productDeltas = new Map<string, number>();
  const productSnapshots = new Map<string, Product>();

  const reserveProduct = (product: Product, quantity: number) => {
    productSnapshots.set(product.id, product);
    productDeltas.set(product.id, (productDeltas.get(product.id) ?? 0) + quantity);
  };

  for (const item of items) {
    if (item.type === 'product') {
      const product = getProductById(item.id);
      if (!product) {
        throw new Error(`Product not found: ${item.id}`);
      }

      reserveProduct(product, item.quantity);
      continue;
    }

    const serie = getSerieById(item.serieId);
    if (!serie) {
      throw new Error(`Series not found: ${item.serieId}`);
    }

    const components = normalizeBoxComponents(serie, item.components);
    if (components.length === 0) {
      throw new Error(`Box ${serie.name} has no configured products.`);
    }

    for (const component of components) {
      const product = getProductById(component.productId);
      if (!product) {
        throw new Error(`Product not found for box ${serie.name}: ${component.productId}`);
      }

      reserveProduct(product, component.quantity * item.quantity);
    }
  }

  for (const [productId, required] of productDeltas.entries()) {
    const product = productSnapshots.get(productId) ?? getProductById(productId);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    if (required > product.stock) {
      throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock}`);
    }
  }

  for (const [productId, required] of productDeltas.entries()) {
    const product = productSnapshots.get(productId) ?? getProductById(productId);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    await updateProduct({
      ...product,
      stock: product.stock - required,
    });
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
    debtId: null,
    paidAmountCents: subtotalCents,
    remainingCents: 0,
  };
}
