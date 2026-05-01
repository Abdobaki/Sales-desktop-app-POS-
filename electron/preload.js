import { contextBridge, ipcRenderer } from 'electron';

const tableNames = [
  'store_settings',
  'payment_methods',
  'notification_preferences',
  'customers',
  'suppliers',
  'products',
  'supplier_purchases',
  'sales_orders',
  'sales_order_items',
  'barcode_scan_events',
  'inventory_movements',
];

const dbCrudApi = {
  tables: () => ipcRenderer.invoke('db:tables'),
  table: {
    list: (table, options = {}) => ipcRenderer.invoke('db:table:list', { table, options }),
    get: (table, id) => ipcRenderer.invoke('db:table:get', { table, id }),
    create: (table, values = {}) => ipcRenderer.invoke('db:table:create', { table, values }),
    update: (table, id, values = {}) => ipcRenderer.invoke('db:table:update', { table, id, values }),
    delete: (table, id) => ipcRenderer.invoke('db:table:delete', { table, id }),
  },
};

for (const tableName of tableNames) {
  dbCrudApi[tableName] = {
    list: (options = {}) => ipcRenderer.invoke(`db:${tableName}:list`, options),
    get: (id) => ipcRenderer.invoke(`db:${tableName}:get`, id),
    create: (values = {}) => ipcRenderer.invoke(`db:${tableName}:create`, values),
    update: (payload = {}) => ipcRenderer.invoke(`db:${tableName}:update`, payload),
    delete: (id) => ipcRenderer.invoke(`db:${tableName}:delete`, id),
  };
}

const electronAPI = {
  app: {
    ping: () => ipcRenderer.invoke('app:ping'),
  },
  db: {
    ping: () => ipcRenderer.invoke('db:ping'),
    ...dbCrudApi,
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
