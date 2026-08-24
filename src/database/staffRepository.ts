import { Platform } from 'react-native';
import db from './sqlite';

export const getLocalStaff = (): any[] => {
    // 🌐 WEB FALLBACK (localStorage)
    if (Platform.OS === 'web') {
        try {
            const data = localStorage.getItem('@local_users');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to read staff from localStorage:', e);
            return [];
        }
    }

    // 📱 NATIVE (SQLite): Fetch ALL users without strict active filters
    if (!db) return [];
    try {
        const staff = db.getAllSync('SELECT * FROM local_users');
        console.log(`📦 Loaded ${staff.length} total staff members from SQLite`);
        return staff;
    } catch (e) {
        console.error('Failed to fetch local staff from SQLite:', e);
        return [];
    }
};

export const saveStaffToLocal = (staffList: any[]) => {
    if (!Array.isArray(staffList) || staffList.length === 0) return;

    // 🌐 WEB FALLBACK
    if (Platform.OS === 'web') {
        try {
            localStorage.setItem('@local_users', JSON.stringify(staffList));
            console.log(`🌐 Saved ${staffList.length} staff members to localStorage.`);
        } catch (e) {
            console.error('Failed to save staff to localStorage:', e);
        }
        return;
    }

    // 📱 NATIVE (SQLite)
    if (!db) return;

    const statement = db.prepareSync(
        'INSERT OR REPLACE INTO local_users (id, name, role, pinCodeHash, isActive) VALUES (?, ?, ?, ?, ?)'
    );

    try {
        let savedCount = 0;
        for (const user of staffList) {
            // Ensure unique ID, NEVER use Math.random() as a staff ID
            const userId = String(user._id || user.id);
            if (!userId || userId === 'undefined') {
                console.error('Skipping staff member: Missing valid ID', user);
                continue;
            }

            const activeFlag = user.isActive === false ? 0 : 1;
            const pinToSave = user.pinCodeHash || '';

            if (!pinToSave) {
                console.warn(`Skipping staff member ${userId} - Missing pinCodeHash which is required for offline login.`);
                continue;
            }

            statement.executeSync([
                userId,
                user.name || 'Unknown',
                user.role || 'staff',
                pinToSave,
                activeFlag
            ]);
            savedCount++;
        }
        console.log(`📱 Successfully saved ${savedCount} staff members to SQLite.`);
    } catch (error) {
        console.error('Error saving staff to SQLite:', error);
    } finally {
        statement.finalizeSync();
    }
};