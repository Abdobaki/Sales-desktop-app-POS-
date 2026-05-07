import { getDbApi, toDollars, toDateOnly } from './shared';
import { refreshProducts } from './products';
import { refreshSeries } from './series';
import { getSuppliers } from './suppliers';

export type HistoryRecordType = 'sale' | 'purchase';

export type HistoryRecord = {
  id: string; // Internal unique ID (e.g., item ID or purchase ID)
  type: HistoryRecordType;
  sourceId: string; // Order ID or Purchase ID
  date: string;
  productName: string;
  productId?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitCost: number;
  customerOrSupplier: string;
  notes: string;
  receiptNumber?: string;
};

let _history: HistoryRecord[] = [];
let _listeners: (() => void)[] = [];

function notify() {
  _listeners.forEach((l) => l());
}

export async function fetchHistory() {
  const db = getDbApi();
  if (!db) return [];

  try {
    // 1. Fetch Sales Items
    const salesItems = await db.sales_order_items.list();
    const salesOrders = await db.sales_orders.list();
    const customers = await db.table.list('customers');
    
    const orderMap = new Map(salesOrders.map((o: any) => [o.id, o]));
    const customerMap = new Map(customers.map((c: any) => [c.id, c.name]));

    const salesHistory: HistoryRecord[] = salesItems.map((item: any) => {
      const order = orderMap.get(item.sales_order_id);
      return {
        id: item.id,
        type: 'sale',
        sourceId: item.sales_order_id,
        date: toDateOnly(order?.order_date || ''),
        productName: item.product_name_snapshot || 'Unknown Product',
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: toDollars(item.unit_price_cents),
        totalPrice: toDollars(item.line_total_cents),
        unitCost: toDollars(item.unit_cost_cents || 0),
        customerOrSupplier: customerMap.get(order?.customer_id) || 'Guest',
        notes: order?.notes || '',
        receiptNumber: order?.receipt_number,
      };
    });

    // 2. Fetch Purchases
    const purchases = await db.supplier_purchases.list();
    const suppliers = getSuppliers();
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

    const purchaseHistory: HistoryRecord[] = purchases.map((p: any) => ({
      id: p.id,
      type: 'purchase',
      sourceId: p.id,
      date: toDateOnly(p.purchase_date),
      productName: p.product_name_snapshot || 'Unknown Product',
      productId: p.product_id,
      quantity: p.quantity,
      unitPrice: toDollars(p.unit_cost_cents), // For purchase, price is cost
      totalPrice: toDollars(p.total_cost_cents),
      unitCost: toDollars(p.unit_cost_cents),
      customerOrSupplier: supplierMap.get(p.supplier_id) || 'Unknown Supplier',
      notes: p.notes || '',
    }));

    _history = [...salesHistory, ...purchaseHistory].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    notify();
    return _history;
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return [];
  }
}

export function getHistory() {
  return _history;
}

export function subscribeHistory(listener: () => void) {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}

export async function updateHistoryRecord(record: HistoryRecord, updates: Partial<HistoryRecord>) {
  const db = getDbApi();
  if (!db) return;

  if (record.type === 'sale') {
    await (window as any).electronAPI.db.history.updateSaleItem({
      itemId: record.id,
      quantity: updates.quantity,
      unitPriceCents: updates.unitPrice !== undefined ? Math.round(updates.unitPrice * 100) : undefined,
      unitCostCents: updates.unitCost !== undefined ? Math.round(updates.unitCost * 100) : undefined,
      productId: updates.productId,
      productNameSnapshot: updates.productName,
    });
  } else {
    await (window as any).electronAPI.db.history.updatePurchase({
      purchaseId: record.id,
      quantity: updates.quantity,
      unitCostCents: updates.unitCost !== undefined ? Math.round(updates.unitCost * 100) : undefined,
      productId: updates.productId,
      productNameSnapshot: updates.productName,
      date: updates.date,
      notes: updates.notes,
    });
  }

  await fetchHistory();
  await refreshProducts();
  await refreshSeries();
}

export async function deleteHistoryRecord(record: HistoryRecord) {
  const db = getDbApi();
  if (!db) return;

  if (record.type === 'sale') {
    await (window as any).electronAPI.db.history.deleteSaleItem(record.id);
  } else {
    await (window as any).electronAPI.db.history.deletePurchase(record.id);
  }

  await fetchHistory();
  await refreshProducts();
  await refreshSeries();
}
