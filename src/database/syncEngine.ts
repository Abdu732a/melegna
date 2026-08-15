import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveStaffToLocal } from './staffRepository';
import { saveMenuToLocal } from './menuRepository';
import { getPendingOrders, markOrderAsSynced } from './orderRepository';

const API_BASE_URL: string = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.100:5000';
const POS_SYNC_SECRET: string = process.env.EXPO_PUBLIC_POS_SYNC_SECRET || 'offline_pos_secret_key';

interface LocalOrder {
    clientOrderId: string;
    tableNumber: string;
    waiterId: string;
    items: string; // JSON string representation
    totalAmount: number;
}

let isSyncing = false;

const performSync = async (): Promise<void> => {
    if (isSyncing) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    isSyncing = true;

    try {
        // 1. Pull latest Menu & Staff from Backend
        const menuRes = await fetch(`${API_BASE_URL}/api/menu`);
        if (menuRes.ok) {
            const menuData = await menuRes.json();
            saveMenuToLocal(menuData);
        }

        const staffRes = await fetch(`${API_BASE_URL}/api/auth/staff`);
        if (staffRes.ok) {
            const staffData = await staffRes.json();
            saveStaffToLocal(staffData);
        }

        // 2. Push Pending Offline Orders to Backend
        const pendingOrders = getPendingOrders() as LocalOrder[];
        if (pendingOrders.length === 0) {
            isSyncing = false;
            return;
        }

        let token: string | null = await AsyncStorage.getItem('@auth_token');

        // Fallback to POS_SYNC_SECRET if token is missing or set to 'offline_token'
        if (!token || token === 'offline_token') {
            token = POS_SYNC_SECRET;
        }

        for (const order of pendingOrders) {
            const response = await fetch(`${API_BASE_URL}/api/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    clientOrderId: order.clientOrderId,
                    tableNumber: order.tableNumber,
                    waiterId: order.waiterId,
                    items: JSON.parse(order.items),
                    totalAmount: order.totalAmount
                })
            });

            if (response.ok) {
                markOrderAsSynced(order.clientOrderId);
                console.log(`Order synced successfully: ${order.clientOrderId}`);
            } else {
                console.error(`Failed to sync order ${order.clientOrderId}. Backend returned ${response.status}`);
            }
        }
    } catch (error) {
        console.log('Sync engine running offline or network interrupted.', error);
    } finally {
        isSyncing = false;
    }
};

export const startSyncEngine = (): void => {
    setInterval(performSync, 15000);
};

export const triggerSyncEngine = async (): Promise<void> => {
    console.log("Manual sync triggered to push offline orders...");
    await performSync();
};