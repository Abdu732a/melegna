import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDB = (): SQLite.SQLiteDatabase | null => {
  if (Platform.OS === 'web') return null;

  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync('melegna_pos.db');
  }
  return dbInstance;
};

export const initLocalDB = () => {
  const db = getDB();

  if (Platform.OS === 'web' || !db) {
    console.warn('📦 SQLite database initialization skipped on Web platform.');
    return;
  }

  db.execSync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS local_users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            pinCodeHash TEXT NOT NULL,
            isActive INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS local_menu (
            id TEXT PRIMARY KEY,
            nameAmharic TEXT NOT NULL,
            nameEnglish TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            imageUrl TEXT,
            isAvailable INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS local_orders (
            clientOrderId TEXT PRIMARY KEY,
            tableNumber TEXT NOT NULL,
            waiterId TEXT NOT NULL,
            items TEXT NOT NULL, -- Stored as JSON string
            totalAmount REAL NOT NULL,
            status TEXT DEFAULT 'SUBMITTED',
            isPaid INTEGER DEFAULT 0,
            paymentMethod TEXT DEFAULT 'NONE',
            synced INTEGER DEFAULT 0 -- 0 = Pending sync to backend, 1 = Synced
        );
    `);
  console.log('📦 Local SQLite database initialized successfully.');
};

export default getDB;