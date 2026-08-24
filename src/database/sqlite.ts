import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const db = Platform.OS !== 'web' ? SQLite.openDatabaseSync('melegna_pos.db') : null;

export const initLocalDB = () => {
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
            items TEXT NOT NULL,
            totalAmount REAL NOT NULL,
            status TEXT DEFAULT 'SUBMITTED',
            isPaid INTEGER DEFAULT 0,
            paymentMethod TEXT DEFAULT 'NONE',
            synced INTEGER DEFAULT 0
        );
    `);
  console.log('📦 Local SQLite database initialized successfully.');
};

// Clear SQLite tables to verify fresh sync tests
export const clearLocalSQLite = () => {
  if (Platform.OS === 'web') {
    localStorage.clear();
    console.log('🌐 LocalStorage cleared.');
    return;
  }
  if (!db) return;
  db.execSync(`
    DELETE FROM local_users;
    DELETE FROM local_menu;
    DELETE FROM local_orders;
  `);
  console.log('🧹 SQLite database wiped clean successfully.');
};

export default db;