import { ipcMain } from 'electron';
import { getDatabasePath } from '../db/index.js';
import { registerCrudHandlers, TABLE_NAMES } from './crud.js';
import { 
  checkoutSale, listSeries, getSeriesById, saveSeries, deleteSeries,
  updateSaleOrderItem, deleteSaleOrderItem, updatePurchaseLine, deletePurchase,
  listDebts, getDebtById, recordDebtPayment, deleteDebt
} from '../services/index.js';

export function registerHandlers({ db }) {
  ipcMain.handle('app:ping', () => {
    return {
      ok: true,
      source: 'main',
    };
  });

  ipcMain.handle('db:ping', () => {
    const row = db.prepare('SELECT 1 AS ok').get();

    return {
      ok: row?.ok === 1,
      path: getDatabasePath(),
    };
  });

  ipcMain.handle('db:tables', () => {
    return TABLE_NAMES;
  });

  ipcMain.handle('db:series:list', (_event, payload = {}) => {
    return listSeries(db, payload);
  });

  ipcMain.handle('db:series:get', (_event, payload = {}) => {
    const id = typeof payload === 'object' && payload !== null ? payload.id : payload;
    return getSeriesById(db, id);
  });

  ipcMain.handle('db:series:create', (_event, payload = {}) => {
    return saveSeries(db, payload);
  });

  ipcMain.handle('db:series:update', (_event, payload = {}) => {
    return saveSeries(db, payload);
  });

  ipcMain.handle('db:series:delete', (_event, payload = {}) => {
    return deleteSeries(db, payload);
  });

  ipcMain.handle('sales:checkout', (_event, payload = {}) => {
    return checkoutSale(db, payload);
  });
  
  ipcMain.handle('history:update-sale-item', (_event, payload = {}) => {
    return updateSaleOrderItem(db, payload);
  });

  ipcMain.handle('history:delete-sale-item', (_event, itemId) => {
    return deleteSaleOrderItem(db, itemId);
  });

  ipcMain.handle('history:update-purchase', (_event, payload = {}) => {
    return updatePurchaseLine(db, payload);
  });

  ipcMain.handle('history:delete-purchase', (_event, purchaseId) => {
    return deletePurchase(db, purchaseId);
  });

  ipcMain.handle('debts:list', (_event, payload = {}) => {
    return listDebts(db, payload);
  });

  ipcMain.handle('debts:get', (_event, id) => {
    return getDebtById(db, id);
  });

  ipcMain.handle('debts:pay', (_event, payload = {}) => {
    return recordDebtPayment(db, payload);
  });

  ipcMain.handle('debts:delete', (_event, id) => {
    return deleteDebt(db, id);
  });

  registerCrudHandlers({ db });
}
