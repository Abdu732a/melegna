import { Platform } from 'react-native';
import db from './sqlite';

export const getLocalMenu = (): any[] => {
    // 🌐 WEB FALLBACK
    if (Platform.OS === 'web') {
        try {
            const data = localStorage.getItem('@local_menu');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to read menu from localStorage:', e);
            return [];
        }
    }

    // 📱 NATIVE (Android/iOS)
    if (!db) return [];
    return db.getAllSync('SELECT * FROM local_menu WHERE isAvailable = 1');
};

export const saveMenuToLocal = (menuItems: any[]) => {
    if (!Array.isArray(menuItems)) return;

    // 🌐 WEB FALLBACK
    if (Platform.OS === 'web') {
        try {
            localStorage.setItem('@local_menu', JSON.stringify(menuItems));
            console.log(`🌐 Saved ${menuItems.length} menu items to localStorage.`);
        } catch (e) {
            console.error('Failed to save menu to localStorage:', e);
        }
        return;
    }

    // 📱 NATIVE (Android/iOS)
    if (!db) return;

    const statement = db.prepareSync(
        'INSERT OR REPLACE INTO local_menu (id, nameAmharic, nameEnglish, category, price, imageUrl, isAvailable) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    try {
        for (const item of menuItems) {
            statement.executeSync([
                String(item._id || item.id),
                item.nameAmharic || '',
                item.nameEnglish || '',
                item.category || 'General',
                Number(item.price || 0),
                item.imageUrl || '',
                item.isAvailable === false ? 0 : 1
            ]);
        }
        console.log(`📱 Saved ${menuItems.length} menu items into SQLite.`);
    } catch (error) {
        console.error('Error saving menu to SQLite:', error);
    } finally {
        statement.finalizeSync();
    }
};