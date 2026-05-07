import path from 'node:path';
import Database from 'better-sqlite3';
import { runSchemaMigrations } from './schema.js';

let db = null;
let dbPath = '';

export function initDatabase(userDataPath) {
  if (db) {
    return db;
  }

  dbPath = path.join(userDataPath, 'pos.sqlite3');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runSchemaMigrations(db);
  db.prepare('SELECT 1').get();

  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database has not been initialized yet.');
  }

  return db;
}

export function getDatabasePath() {
  return dbPath;
}

export function closeDatabase() {
  if (!db) {
    return;
  }

  db.close();
  db = null;
}
