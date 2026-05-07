import { ipcMain } from 'electron';

export const TABLE_NAMES = [
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

const SINGLETON_TABLES = new Set(['store_settings', 'notification_preferences']);

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function normalizeObject(input, label) {
  if (input === undefined || input === null) {
    return {};
  }

  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${label} must be an object.`);
  }

  return input;
}

function sanitizeTableName(table) {
  if (!TABLE_NAMES.includes(table)) {
    throw new Error(`Unsupported table: ${table}`);
  }

  return table;
}

function getTableMeta(db, tableName) {
  const tableInfo = db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all();
  if (tableInfo.length === 0) {
    throw new Error(`Table metadata not found for ${tableName}`);
  }

  const primaryKey = tableInfo.find((column) => column.pk === 1)?.name;
  if (!primaryKey) {
    throw new Error(`Table ${tableName} must define a primary key.`);
  }

  const columns = tableInfo.map((column) => column.name);
  return {
    tableName,
    primaryKey,
    columns,
    hasUpdatedAt: columns.includes('updated_at'),
    singleton: SINGLETON_TABLES.has(tableName),
  };
}

function resolvePrimaryValue(meta, inputValue) {
  if (inputValue !== undefined && inputValue !== null) {
    return inputValue;
  }

  if (meta.singleton) {
    return 1;
  }

  return undefined;
}

function listRows(db, meta, rawOptions = {}) {
  const options = normalizeObject(rawOptions, 'options');
  const tableSql = quoteIdentifier(meta.tableName);

  const requestedOrderBy = options.orderBy;
  const orderBy =
    typeof requestedOrderBy === 'string' && meta.columns.includes(requestedOrderBy)
      ? requestedOrderBy
      : meta.primaryKey;

  const direction = String(options.orderDirection || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : null;
  const offset = Number.isInteger(options.offset) && options.offset >= 0 ? options.offset : 0;

  let sql = `SELECT * FROM ${tableSql} ORDER BY ${quoteIdentifier(orderBy)} ${direction}`;
  const params = [];

  if (limit !== null) {
    sql += ' LIMIT ?';
    params.push(limit);

    if (offset > 0) {
      sql += ' OFFSET ?';
      params.push(offset);
    }
  }

  return db.prepare(sql).all(...params);
}

function getRow(db, meta, rawPrimaryValue) {
  const primaryValue = resolvePrimaryValue(meta, rawPrimaryValue);
  if (primaryValue === undefined) {
    throw new Error(`Missing primary key value for table ${meta.tableName}.`);
  }

  const sql = `
    SELECT *
    FROM ${quoteIdentifier(meta.tableName)}
    WHERE ${quoteIdentifier(meta.primaryKey)} = ?
  `;

  return db.prepare(sql).get(primaryValue) ?? null;
}

function createRow(db, meta, rawValues) {
  const values = normalizeObject(rawValues, 'values');

  if (meta.singleton) {
    const existing = getRow(db, meta, 1);
    if (existing) {
      if (Object.keys(values).length === 0) {
        return existing;
      }

      return updateRow(db, meta, 1, values);
    }

    const valuesWithSingletonId = {
      ...values,
      [meta.primaryKey]: 1,
    };

    return createRow(db, { ...meta, singleton: false }, valuesWithSingletonId);
  }

  const allowedColumns = new Set(meta.columns);
  const entries = Object.entries(values).filter(([column, value]) => {
    return allowedColumns.has(column) && value !== undefined;
  });

  const tableSql = quoteIdentifier(meta.tableName);
  let runInfo;

  if (entries.length === 0) {
    runInfo = db.prepare(`INSERT INTO ${tableSql} DEFAULT VALUES`).run();
  } else {
    const columnsSql = entries.map(([column]) => quoteIdentifier(column)).join(', ');
    const placeholders = entries.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableSql} (${columnsSql}) VALUES (${placeholders})`;
    const params = entries.map(([, value]) => value);
    runInfo = db.prepare(sql).run(...params);
  }

  const explicitPrimaryValue = values[meta.primaryKey];
  if (explicitPrimaryValue !== undefined && explicitPrimaryValue !== null) {
    return getRow(db, meta, explicitPrimaryValue);
  }

  if (meta.singleton) {
    return getRow(db, meta, 1);
  }

  const byRowIdSql = `SELECT * FROM ${tableSql} WHERE rowid = ?`;
  const insertedRow = db.prepare(byRowIdSql).get(runInfo.lastInsertRowid);
  if (insertedRow) {
    return insertedRow;
  }

  throw new Error(`Insert succeeded but row lookup failed for ${meta.tableName}.`);
}

function updateRow(db, meta, rawPrimaryValue, rawValues) {
  const primaryValue = resolvePrimaryValue(meta, rawPrimaryValue);
  if (primaryValue === undefined) {
    throw new Error(`Missing primary key value for table ${meta.tableName}.`);
  }

  const values = normalizeObject(rawValues, 'values');
  const protectedColumns = new Set([meta.primaryKey, 'created_at']);

  const entries = Object.entries(values).filter(([column, value]) => {
    return meta.columns.includes(column) && !protectedColumns.has(column) && value !== undefined;
  });

  if (meta.hasUpdatedAt && !entries.some(([column]) => column === 'updated_at')) {
    entries.push(['updated_at', new Date().toISOString()]);
  }

  if (entries.length === 0) {
    throw new Error(`No updatable fields provided for table ${meta.tableName}.`);
  }

  const setSql = entries.map(([column]) => `${quoteIdentifier(column)} = ?`).join(', ');
  const sql = `
    UPDATE ${quoteIdentifier(meta.tableName)}
    SET ${setSql}
    WHERE ${quoteIdentifier(meta.primaryKey)} = ?
  `;

  const params = entries.map(([, value]) => value);
  params.push(primaryValue);

  const info = db.prepare(sql).run(...params);
  if (info.changes === 0) {
    throw new Error(`Row not found in ${meta.tableName} for ${meta.primaryKey}=${primaryValue}`);
  }

  return getRow(db, meta, primaryValue);
}

function deleteRow(db, meta, rawPrimaryValue) {
  if (meta.singleton) {
    throw new Error(`Delete is not allowed for singleton table ${meta.tableName}.`);
  }

  const primaryValue = resolvePrimaryValue(meta, rawPrimaryValue);
  if (primaryValue === undefined) {
    throw new Error(`Missing primary key value for table ${meta.tableName}.`);
  }

  const sql = `
    DELETE FROM ${quoteIdentifier(meta.tableName)}
    WHERE ${quoteIdentifier(meta.primaryKey)} = ?
  `;

  const info = db.prepare(sql).run(primaryValue);
  return {
    deleted: info.changes > 0,
    changes: info.changes,
  };
}

function parseUpdatePayload(meta, rawPayload) {
  const payload = normalizeObject(rawPayload, 'payload');
  const primaryValue =
    payload[meta.primaryKey] !== undefined
      ? payload[meta.primaryKey]
      : payload.id;

  const values = payload.values !== undefined ? payload.values : payload;
  return {
    primaryValue,
    values,
  };
}

function registerGenericTableHandlers(db, tableMetaMap) {
  ipcMain.handle('db:table:list', (_event, payload = {}) => {
    const input = normalizeObject(payload, 'payload');
    const table = sanitizeTableName(String(input.table || ''));
    const meta = tableMetaMap.get(table);
    return listRows(db, meta, input.options);
  });

  ipcMain.handle('db:table:get', (_event, payload = {}) => {
    const input = normalizeObject(payload, 'payload');
    const table = sanitizeTableName(String(input.table || ''));
    const meta = tableMetaMap.get(table);
    return getRow(db, meta, input.id);
  });

  ipcMain.handle('db:table:create', (_event, payload = {}) => {
    const input = normalizeObject(payload, 'payload');
    const table = sanitizeTableName(String(input.table || ''));
    const meta = tableMetaMap.get(table);
    return createRow(db, meta, input.values);
  });

  ipcMain.handle('db:table:update', (_event, payload = {}) => {
    const input = normalizeObject(payload, 'payload');
    const table = sanitizeTableName(String(input.table || ''));
    const meta = tableMetaMap.get(table);
    return updateRow(db, meta, input.id, input.values);
  });

  ipcMain.handle('db:table:delete', (_event, payload = {}) => {
    const input = normalizeObject(payload, 'payload');
    const table = sanitizeTableName(String(input.table || ''));
    const meta = tableMetaMap.get(table);
    return deleteRow(db, meta, input.id);
  });
}

function registerPerTableHandlers(db, tableMetaMap) {
  for (const tableName of TABLE_NAMES) {
    const meta = tableMetaMap.get(tableName);
    const prefix = `db:${tableName}`;

    ipcMain.handle(`${prefix}:list`, (_event, options = {}) => {
      return listRows(db, meta, options);
    });

    ipcMain.handle(`${prefix}:get`, (_event, primaryValue) => {
      return getRow(db, meta, primaryValue);
    });

    ipcMain.handle(`${prefix}:create`, (_event, values = {}) => {
      return createRow(db, meta, values);
    });

    ipcMain.handle(`${prefix}:update`, (_event, payload = {}) => {
      const { primaryValue, values } = parseUpdatePayload(meta, payload);
      return updateRow(db, meta, primaryValue, values);
    });

    ipcMain.handle(`${prefix}:delete`, (_event, primaryValue) => {
      return deleteRow(db, meta, primaryValue);
    });
  }
}

export function registerCrudHandlers({ db }) {
  const tableMetaMap = new Map();

  for (const tableName of TABLE_NAMES) {
    tableMetaMap.set(tableName, getTableMeta(db, tableName));
  }

  registerGenericTableHandlers(db, tableMetaMap);
  registerPerTableHandlers(db, tableMetaMap);
}
