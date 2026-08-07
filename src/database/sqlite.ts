import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getLocalDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (dbInstance) return dbInstance;

    dbInstance = await SQLite.openDatabaseAsync('cafe_pos_offline.db');

    // Enable WAL mode for crash-proof local writes
    await dbInstance.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS orders (
      client_order_id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL, -- CREATED, PENDING_PRINT, PRINTED, PENDING_SYNC, SYNCED
      total_amount REAL NOT NULL,
      items_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      client_order_id TEXT UNIQUE NOT NULL,
      payload TEXT NOT NULL,
      sync_status TEXT NOT NULL, -- PENDING, IN_PROGRESS, FAILED, SYNCED
      retry_count INTEGER DEFAULT 0,
      last_attempt INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS print_queue (
      id TEXT PRIMARY KEY NOT NULL,
      client_order_id TEXT NOT NULL,
      raw_esc_pos TEXT NOT NULL,
      print_status TEXT NOT NULL, -- PENDING, PRINTING, PRINTED, FAILED
      retry_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

    return dbInstance;
}