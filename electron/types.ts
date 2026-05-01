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
