import { getDbApi, toDateOnly, toDollars } from './shared';

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  lastPurchase: string;
};

const seedCustomers: Customer[] = [
  { id: '1', name: 'Sarah Johnson', email: 'sarah.j@email.com', phone: '(555) 123-4567', totalOrders: 12, totalSpent: 1248.88, lastPurchase: '2026-04-08' },
  { id: '2', name: 'Michael Chen', email: 'mchen@email.com', phone: '(555) 234-5678', totalOrders: 8, totalSpent: 892.45, lastPurchase: '2026-04-05' },
  { id: '3', name: 'Emma Davis', email: 'emma.davis@email.com', phone: '(555) 345-6789', totalOrders: 15, totalSpent: 2156.30, lastPurchase: '2026-04-09' },
  { id: '4', name: 'James Wilson', email: 'jwilson@email.com', phone: '(555) 456-7890', totalOrders: 5, totalSpent: 567.20, lastPurchase: '2026-04-01' },
  { id: '5', name: 'Olivia Martinez', email: 'olivia.m@email.com', phone: '(555) 567-8901', totalOrders: 20, totalSpent: 3445.75, lastPurchase: '2026-04-10' },
];

let _customers: Customer[] = [...seedCustomers];
let _listeners: (() => void)[] = [];
let _initPromise: Promise<void> | null = null;

type CustomerMetrics = {
  totalOrders: number;
  totalSpent: number;
  lastPurchase: string;
};

function notifyCustomers() {
  _listeners.forEach((listener) => listener());
}

function parseCustomerBase(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
  };
}

function buildMetricsByCustomer(salesOrders: Record<string, unknown>[]) {
  const metrics = new Map<string, CustomerMetrics>();

  for (const order of salesOrders) {
    const customerId = order.customer_id ? String(order.customer_id) : '';
    if (!customerId) {
      continue;
    }

    const current = metrics.get(customerId) ?? {
      totalOrders: 0,
      totalSpent: 0,
      lastPurchase: '-',
    };

    current.totalOrders += 1;
    current.totalSpent += toDollars(order.total_cents);

    const soldAt = String(order.sold_at ?? '');
    if (soldAt) {
      if (current.lastPurchase === '-' || soldAt > current.lastPurchase) {
        current.lastPurchase = soldAt;
      }
    }

    metrics.set(customerId, current);
  }

  return metrics;
}

function composeCustomers(rows: Record<string, unknown>[], metrics: Map<string, CustomerMetrics>): Customer[] {
  return rows.map((row) => {
    const base = parseCustomerBase(row);
    const metric = metrics.get(base.id);
    return {
      ...base,
      totalOrders: metric?.totalOrders ?? 0,
      totalSpent: metric?.totalSpent ?? 0,
      lastPurchase: metric?.lastPurchase ? toDateOnly(metric.lastPurchase) : '-',
    };
  });
}

function buildSeedMetricsMap() {
  return new Map(
    seedCustomers.map((customer) => [
      customer.id,
      {
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
        lastPurchase: customer.lastPurchase,
      },
    ])
  );
}

async function seedCustomersIfEmpty() {
  const db = getDbApi();
  if (!db) {
    return;
  }

  const existing = await db.customers.list({ limit: 1 });
  if (existing.length > 0) {
    return;
  }

  for (const customer of seedCustomers) {
    await db.customers.create({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      is_active: 1,
    });
  }
}

async function loadCustomersFromDb() {
  const db = getDbApi();
  if (!db) {
    return;
  }

  await seedCustomersIfEmpty();
  const [customerRows, salesOrders] = await Promise.all([
    db.customers.list({ orderBy: 'name' }),
    db.sales_orders.list({ orderBy: 'sold_at', orderDirection: 'DESC' }),
  ]);

  const metricsByCustomer = salesOrders.length > 0 ? buildMetricsByCustomer(salesOrders) : buildSeedMetricsMap();
  _customers = composeCustomers(customerRows, metricsByCustomer);
  notifyCustomers();
}

function ensureInitialized() {
  if (_initPromise) {
    return _initPromise;
  }

  _initPromise = loadCustomersFromDb().catch((error) => {
    console.error('[customers] Failed to initialize from DB:', error);
  });

  return _initPromise;
}

void ensureInitialized();

export function getCustomers() {
  return [..._customers];
}

export async function addCustomer(c: Omit<Customer, 'id' | 'totalOrders' | 'totalSpent' | 'lastPurchase'>) {
  await ensureInitialized();
  const db = getDbApi();

  if (!db) {
    const newCustomer: Customer = {
      ...c,
      id: `${Date.now()}`,
      totalOrders: 0,
      totalSpent: 0,
      lastPurchase: '-',
    };

    _customers = [..._customers, newCustomer];
    notifyCustomers();
    return newCustomer;
  }

  const row = await db.customers.create({
    name: c.name,
    email: c.email,
    phone: c.phone,
    is_active: 1,
  });

  if (!row) {
    throw new Error('Failed to create customer');
  }

  const newCustomer: Customer = {
    ...parseCustomerBase(row),
    totalOrders: 0,
    totalSpent: 0,
    lastPurchase: '-',
  };

  _customers = [..._customers, newCustomer];
  notifyCustomers();
  return newCustomer;
}

export async function updateCustomer(updated: Customer) {
  await ensureInitialized();
  const db = getDbApi();

  if (db) {
    await db.customers.update({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      is_active: 1,
    });
  }

  _customers = _customers.map((customer) => {
    if (customer.id !== updated.id) {
      return customer;
    }

    return {
      ...customer,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
    };
  });
  notifyCustomers();
}

export async function deleteCustomer(id: string) {
  await ensureInitialized();
  const db = getDbApi();

  if (db) {
    await db.customers.delete(id);
  }

  _customers = _customers.filter((customer) => customer.id !== id);
  notifyCustomers();
}

export function subscribeCustomers(listener: () => void) {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}
