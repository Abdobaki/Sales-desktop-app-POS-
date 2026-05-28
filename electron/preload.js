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

const seriesApi = {
  list: (options = {}) => ipcRenderer.invoke('db:series:list', options),
  get: (id) => ipcRenderer.invoke('db:series:get', { id }),
  create: (values = {}) => ipcRenderer.invoke('db:series:create', values),
  update: (payload = {}) => ipcRenderer.invoke('db:series:update', payload),
  delete: (id) => ipcRenderer.invoke('db:series:delete', { id }),
};

const salesApi = {
  checkout: (payload = {}) => ipcRenderer.invoke('sales:checkout', payload),
};

const historyApi = {
  updateSaleItem: (payload = {}) => ipcRenderer.invoke('history:update-sale-item', payload),
  deleteSaleItem: (itemId) => ipcRenderer.invoke('history:delete-sale-item', itemId),
  updatePurchase: (payload = {}) => ipcRenderer.invoke('history:update-purchase', payload),
  deletePurchase: (purchaseId) => ipcRenderer.invoke('history:delete-purchase', purchaseId),
};

const debtsApi = {
  list: (payload = {}) => ipcRenderer.invoke('debts:list', payload),
  get: (id) => ipcRenderer.invoke('debts:get', id),
  pay: (payload = {}) => ipcRenderer.invoke('debts:pay', payload),
  delete: (id) => ipcRenderer.invoke('debts:delete', id),
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
    series: seriesApi,
    sales: salesApi,
    history: historyApi,
    debts: debtsApi,
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
