import { getDbApi, toDollars, toDateOnly } from './shared';

export type DebtStatus = 'unpaid' | 'partial' | 'paid';

export type Debt = {
  id: string;
  salesOrderId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  receiptNumber: string;
  soldAt: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: DebtStatus;
  notes: string;
  createdAt: string;
};

let _debts: Debt[] = [];
let _listeners: (() => void)[] = [];

function notify() {
  _listeners.forEach((l) => l());
}

function mapDebtRow(row: Record<string, unknown>): Debt {
  return {
    id: String(row.id ?? ''),
    salesOrderId: String(row.sales_order_id ?? ''),
    customerId: String(row.customer_id ?? ''),
    customerName: String(row.customer_name ?? ''),
    customerPhone: String(row.customer_phone ?? ''),
    receiptNumber: String(row.receipt_number ?? ''),
    soldAt: toDateOnly(row.sold_at),
    totalAmount: toDollars(row.total_cents),
    paidAmount: toDollars(row.paid_cents),
    remainingAmount: toDollars(row.remaining_cents),
    status: (row.status as DebtStatus) ?? 'unpaid',
    notes: String(row.notes ?? ''),
    createdAt: toDateOnly(row.created_at),
  };
}

export async function fetchDebts(filters?: { status?: DebtStatus; customerId?: string }) {
  const db = getDbApi();
  if (!db?.debts?.list) return [];

  try {
    const rows = await db.debts.list(filters ?? {});
    _debts = (rows as Record<string, unknown>[]).map(mapDebtRow);
    notify();
    return _debts;
  } catch (error) {
    console.error('[debts] Failed to fetch debts:', error);
    return [];
  }
}

export function getDebts() {
  return _debts;
}

export function subscribeDebts(listener: () => void) {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}

export async function payDebt(debtId: string, amountCents: number) {
  const db = getDbApi();
  if (!db?.debts?.pay) throw new Error('Debt API not available.');

  const result = await db.debts.pay({ debtId, amountCents });
  await fetchDebts();
  return result;
}

export async function deleteDebt(debtId: string) {
  const db = getDbApi();
  if (!db?.debts?.delete) throw new Error('Debt API not available.');

  await db.debts.delete(debtId);
  await fetchDebts();
}
