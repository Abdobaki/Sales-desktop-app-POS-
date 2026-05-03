import { getDbApi } from './shared';

export type StoreSettings = {
  id: number;
  storeName: string;
  email: string;
  phone: string;
  address: string;
  lowStockThreshold: number;
  currencyCode: string;
  updatedAt: string;
};

export type PaymentMethodSetting = {
  code: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
};

export type NotificationPreferences = {
  id: number;
  lowStockAlertsEnabled: boolean;
  dailySalesSummaryEnabled: boolean;
  newCustomerSignupsEnabled: boolean;
  updatedAt: string;
};

const defaultStoreSettings: StoreSettings = {
  id: 1,
  storeName: 'Fashion Boutique',
  email: '',
  phone: '',
  address: '',
  lowStockThreshold: 10,
  currencyCode: 'DZD',
  updatedAt: new Date().toISOString(),
};

const defaultPaymentMethods: PaymentMethodSetting[] = [
  { code: 'credit_card', label: 'Credit Card', enabled: true, sortOrder: 1 },
  { code: 'debit_card', label: 'Debit Card', enabled: true, sortOrder: 2 },
  { code: 'cash', label: 'Cash', enabled: true, sortOrder: 3 },
  { code: 'digital_wallet', label: 'Digital Wallet', enabled: true, sortOrder: 4 },
];

const defaultNotificationPreferences: NotificationPreferences = {
  id: 1,
  lowStockAlertsEnabled: true,
  dailySalesSummaryEnabled: true,
  newCustomerSignupsEnabled: true,
  updatedAt: new Date().toISOString(),
};

let _storeSettings = { ...defaultStoreSettings };
let _paymentMethods = defaultPaymentMethods.map((method) => ({ ...method }));
let _notificationPreferences = { ...defaultNotificationPreferences };
let _listeners: (() => void)[] = [];
let _initPromise: Promise<void> | null = null;

function notify() {
  _listeners.forEach((listener) => listener());
}

function toBool(value: unknown): boolean {
  return Number(value ?? 0) === 1;
}

function parseStoreSettings(row: Record<string, unknown> | null | undefined): StoreSettings {
  if (!row) {
    return { ...defaultStoreSettings };
  }

  return {
    id: Number(row.id ?? 1),
    storeName: String(row.store_name ?? row.storeName ?? defaultStoreSettings.storeName),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    address: String(row.address ?? ''),
    lowStockThreshold: Math.max(0, Math.trunc(Number(row.low_stock_threshold ?? row.lowStockThreshold ?? 10))),
    currencyCode: String(row.currency_code ?? row.currencyCode ?? 'DZD') || 'DZD',
    updatedAt: String(row.updated_at ?? row.updatedAt ?? new Date().toISOString()),
  };
}

function parsePaymentMethod(row: Record<string, unknown>): PaymentMethodSetting {
  return {
    code: String(row.code ?? ''),
    label: String(row.label ?? ''),
    enabled: toBool(row.enabled),
    sortOrder: Number.isFinite(Number(row.sort_order ?? row.sortOrder)) ? Math.trunc(Number(row.sort_order ?? row.sortOrder)) : 0,
  };
}

function parseNotificationPreferences(row: Record<string, unknown> | null | undefined): NotificationPreferences {
  if (!row) {
    return { ...defaultNotificationPreferences };
  }

  return {
    id: Number(row.id ?? 1),
    lowStockAlertsEnabled: toBool(row.low_stock_alerts_enabled ?? row.lowStockAlertsEnabled),
    dailySalesSummaryEnabled: toBool(row.daily_sales_summary_enabled ?? row.dailySalesSummaryEnabled),
    newCustomerSignupsEnabled: toBool(row.new_customer_signups_enabled ?? row.newCustomerSignupsEnabled),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? new Date().toISOString()),
  };
}

async function loadSettingsFromDb() {
  const db = getDbApi();
  if (!db) {
    return;
  }

  const [storeRow, paymentRows, notificationRow] = await Promise.all([
    db.store_settings.get(1),
    db.payment_methods.list({ orderBy: 'sort_order', orderDirection: 'ASC' }),
    db.notification_preferences.get(1),
  ]);

  _storeSettings = parseStoreSettings(storeRow as Record<string, unknown> | null | undefined);
  _paymentMethods = (paymentRows.length > 0 ? paymentRows : defaultPaymentMethods).map((row, index) =>
    parsePaymentMethod({
      ...(row as Record<string, unknown>),
      sort_order: (row as Record<string, unknown>).sort_order ?? index + 1,
    })
  );
  _notificationPreferences = parseNotificationPreferences(notificationRow as Record<string, unknown> | null | undefined);
  notify();
}

function ensureInitialized() {
  if (_initPromise) {
    return _initPromise;
  }

  _initPromise = loadSettingsFromDb().catch((error) => {
    console.error('[settings] Failed to initialize from DB:', error);
  });

  return _initPromise;
}

void ensureInitialized();

export async function refreshSettings() {
  await loadSettingsFromDb();
}

export function getStoreSettings() {
  return { ..._storeSettings };
}

export function getPaymentMethods() {
  return _paymentMethods.map((method) => ({ ...method }));
}

export function getNotificationPreferences() {
  return { ..._notificationPreferences };
}

export function subscribeSettings(listener: () => void) {
  _listeners.push(listener);
  listener();
  return () => {
    _listeners = _listeners.filter((current) => current !== listener);
  };
}

export async function saveStoreSettings(next: Partial<StoreSettings>) {
  await ensureInitialized();
  const merged = { ..._storeSettings, ...next };
  const db = getDbApi();

  if (db) {
    await db.store_settings.update({
      id: merged.id,
      store_name: merged.storeName,
      email: merged.email || null,
      phone: merged.phone || null,
      address: merged.address || null,
      low_stock_threshold: merged.lowStockThreshold,
      currency_code: merged.currencyCode,
    });

    await refreshSettings();
    return getStoreSettings();
  }

  _storeSettings = merged;
  notify();
  return getStoreSettings();
}

export async function savePaymentMethods(nextMethods: PaymentMethodSetting[]) {
  await ensureInitialized();
  const normalized = nextMethods.map((method, index) => ({
    ...method,
    sortOrder: Number.isFinite(method.sortOrder) ? method.sortOrder : index + 1,
  }));
  const db = getDbApi();

  if (db) {
    for (const method of normalized) {
      await db.payment_methods.update({
        id: method.code,
        label: method.label,
        enabled: method.enabled ? 1 : 0,
        sort_order: method.sortOrder,
      });
    }

    await refreshSettings();
    return getPaymentMethods();
  }

  _paymentMethods = normalized.map((method) => ({ ...method }));
  notify();
  return getPaymentMethods();
}

export async function saveNotificationPreferences(next: Partial<NotificationPreferences>) {
  await ensureInitialized();
  const merged = { ..._notificationPreferences, ...next };
  const db = getDbApi();

  if (db) {
    await db.notification_preferences.update({
      id: merged.id,
      low_stock_alerts_enabled: merged.lowStockAlertsEnabled ? 1 : 0,
      daily_sales_summary_enabled: merged.dailySalesSummaryEnabled ? 1 : 0,
      new_customer_signups_enabled: merged.newCustomerSignupsEnabled ? 1 : 0,
    });

    await refreshSettings();
    return getNotificationPreferences();
  }

  _notificationPreferences = merged;
  notify();
  return getNotificationPreferences();
}
