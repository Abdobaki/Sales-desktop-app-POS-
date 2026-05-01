import { ipcMain } from 'electron';
import { getDatabasePath } from '../db/index.js';
import { registerCrudHandlers, TABLE_NAMES } from './crud.js';

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

  registerCrudHandlers({ db });
}
