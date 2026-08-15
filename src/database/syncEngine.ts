import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getDB } from './sqlite';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://melegna.onrender.com';
const SYNC_SECRET = process.env.EXPO_PUBLIC_POS_SYNC_SECRET || '';

/**
 * Pushes pending offline orders from 'local_orders' to Render API
 */
export async function pushPendingOrders() {
    if (Platform.OS === 'web') return;

    const db = getDB();
    if (!db) return;

    try {
        const pendingOrders = await db.getAllAsync<any>(
            'SELECT * FROM local_orders WHERE synced = 0'
        );

        if (!pendingOrders || pendingOrders.length === 0) return;

        for (const order of pendingOrders) {
            try {
                const payload = {
                    ...order,
                    items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
                };

                const response = await fetch(`${API_BASE}/api/orders`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-pos-sync-secret': SYNC_SECRET,
                    },
                    body: JSON.stringify(payload),
                });

                if (response.ok) {
                    await db.runAsync('UPDATE local_orders SET synced = 1 WHERE clientOrderId = ?', [
                        order.clientOrderId,
                    ]);
                }
            } catch (err) {
                console.error(`[SyncEngine] Failed to send order #${order.clientOrderId}:`, err);
                break;
            }
        }
    } catch (err) {
        console.error('[SyncEngine] Error querying pending orders:', err);
    }
}

/**
 * Pulls updated menu items and staff into 'local_menu' and 'local_users'
 */
export async function pullBackendData() {
    if (Platform.OS === 'web') return;

    const db = getDB();
    if (!db) return;

    try {
        // 1. Fetch menu updates
        const menuRes = await fetch(`${API_BASE}/api/menu`, {
            headers: { 'x-pos-sync-secret': SYNC_SECRET },
        });
        if (menuRes.ok) {
            const menuData = await menuRes.json();
            for (const item of menuData) {
                await db.runAsync(
                    `INSERT INTO local_menu (id, nameAmharic, nameEnglish, category, price, imageUrl, isAvailable)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             nameAmharic=excluded.nameAmharic,
             nameEnglish=excluded.nameEnglish,
             category=excluded.category,
             price=excluded.price,
             imageUrl=excluded.imageUrl,
             isAvailable=excluded.isAvailable`,
                    [
                        item.id,
                        item.nameAmharic || '',
                        item.nameEnglish || item.name || '',
                        item.category || '',
                        item.price || 0,
                        item.imageUrl || null,
                        item.isAvailable ?? 1,
                    ]
                );
            }
        }

        // 2. Fetch users/staff updates
        const usersRes = await fetch(`${API_BASE}/api/staff`, {
            headers: { 'x-pos-sync-secret': SYNC_SECRET },
        });
        if (usersRes.ok) {
            const usersData = await usersRes.json();
            for (const u of usersData) {
                await db.runAsync(
                    `INSERT INTO local_users (id, name, role, pinCodeHash, isActive)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name=excluded.name,
             role=excluded.role,
             pinCodeHash=excluded.pinCodeHash,
             isActive=excluded.isActive`,
                    [u.id, u.name, u.role, u.pinCodeHash || '', u.isActive ?? 1]
                );
            }
        }
    } catch (err) {
        console.error('[SyncEngine] Error fetching backend data:', err);
    }
}

export async function runFullSync() {
    if (Platform.OS === 'web') return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    await pushPendingOrders();
    await pullBackendData();
}

export function startSyncEngine() {
    if (Platform.OS === 'web') return;

    runFullSync();

    NetInfo.addEventListener((state) => {
        if (state.isConnected && state.isInternetReachable) {
            runFullSync();
        }
    });

    setInterval(() => {
        runFullSync();
    }, 30000);

}