import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveStaffToLocal } from './staffRepository';
import { saveMenuToLocal } from './menuRepository';
import { getPendingOrders, markOrderAsSynced } from './orderRepository';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

interface LocalOrder {
    clientOrderId: string;
    tableNumber: string;
    waiterId: string;
    items: string; // JSON string
    totalAmount: number;
}

// Core sync logic separated so it can be triggered manually or via interval
const performSync = async () => {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

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
        if (pendingOrders.length === 0) return;

        const token = await AsyncStorage.getItem('@auth_token');

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
            }
        }
    } catch (error) {
        console.log('Sync engine running offline or network interrupted.');
    }
};

export const startSyncEngine = () => {
    // Run sync loop every 15 seconds if online
    setInterval(performSync, 15000);
};

// Exported for use in checkout.tsx to force a sync immediately after ordering
export const triggerSyncEngine = async () => {
    console.log("Manual sync triggered to push offline orders...");
    await performSync();
};