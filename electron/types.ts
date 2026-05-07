export type AppPingResponse = {
  ok: boolean;
  source: string;
};

export type DbPingResponse = {
  ok: boolean;
  path?: string;
};

export type DbTableName =
  | 'store_settings'
  | 'payment_methods'
  | 'notification_preferences'
  | 'customers'
  | 'suppliers'
  | 'products'
  | 'supplier_purchases'
  | 'sales_orders'
  | 'sales_order_items'
  | 'barcode_scan_events'
  | 'inventory_movements';

export type DbRow = Record<string, unknown>;

export type DbListOptions = {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC' | 'asc' | 'desc';
};

export type DbUpdatePayload = {
  id?: string | number;
  values: Record<string, unknown>;
};

export type DbDeleteResult = {
  deleted: boolean;
  changes: number;
};

export type SeriesItemRecord = {
  size: string;
  quantity: number;
  sold: number;
};

export type SeriesRecord = {
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
  items: SeriesItemRecord[];
  supplierId?: string;
  createdAt: string;
};

export type SalesCheckoutPayload = {
  sourceView?: 'pos' | 'scanner';
  customerId?: string | null;
  paymentMethodCode?: string | null;
  notes?: string;
  soldAt?: string;
  discountCents?: number;
  taxCents?: number;
  items: Array<Record<string, unknown>>;
};

export type SalesCheckoutResult = {
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

export type DbTableCrudApi = {
  list: (options?: DbListOptions) => Promise<DbRow[]>;
  get: (id?: string | number) => Promise<DbRow | null>;
  create: (values?: Record<string, unknown>) => Promise<DbRow | null>;
  update: (payload?: DbUpdatePayload | Record<string, unknown>) => Promise<DbRow | null>;
  delete: (id?: string | number) => Promise<DbDeleteResult>;
};

export interface ElectronAPI {
  app: {
    ping: () => Promise<AppPingResponse>;
  };
  db: {
    ping: () => Promise<DbPingResponse>;
    tables: () => Promise<DbTableName[]>;
    table: {
      list: (table: DbTableName, options?: DbListOptions) => Promise<DbRow[]>;
      get: (table: DbTableName, id?: string | number) => Promise<DbRow | null>;
      create: (table: DbTableName, values?: Record<string, unknown>) => Promise<DbRow | null>;
      update: (table: DbTableName, id: string | number, values: Record<string, unknown>) => Promise<DbRow | null>;
      delete: (table: DbTableName, id: string | number) => Promise<DbDeleteResult>;
    };
    series: {
      list: (options?: DbListOptions) => Promise<SeriesRecord[]>;
      get: (id?: string | number) => Promise<SeriesRecord | null>;
      create: (values?: Record<string, unknown>) => Promise<SeriesRecord | null>;
      update: (payload?: Record<string, unknown>) => Promise<SeriesRecord | null>;
      delete: (id?: string | number) => Promise<DbDeleteResult>;
    };
    sales: {
      checkout: (payload?: SalesCheckoutPayload) => Promise<SalesCheckoutResult>;
    };
    store_settings: DbTableCrudApi;
    payment_methods: DbTableCrudApi;
    notification_preferences: DbTableCrudApi;
    customers: DbTableCrudApi;
    suppliers: DbTableCrudApi;
    products: DbTableCrudApi;
    supplier_purchases: DbTableCrudApi;
    sales_orders: DbTableCrudApi;
    sales_order_items: DbTableCrudApi;
    barcode_scan_events: DbTableCrudApi;
    inventory_movements: DbTableCrudApi;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
