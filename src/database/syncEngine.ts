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
    items: string; // JSON string representation
    totalAmount: number;
}

let isSyncing = false;
let syncIntervalId: any = null;

// Helper to prevent requests from hanging indefinitely
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } finally {
        clearTimeout(id);
    }
};

const performSync = async (): Promise<void> => {
    if (isSyncing) return;

    if (!API_BASE_URL || API_BASE_URL === 'undefined') {
        console.error('API_BASE_URL is not configured. Stopping synchronization.');
        stopSyncEngine();
        return;
    }

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    isSyncing = true;

    try {
        // 1. Pull latest Menu & Staff from Backend
        try {
            const menuRes = await fetchWithTimeout(`${API_BASE_URL}/api/menu`);
            if (menuRes.ok) {
                const menuData = await menuRes.json();
                saveMenuToLocal(menuData);
            }
        } catch (e) {
            console.warn('Menu background sync skipped/failed:', e);
        }

        try {
            const staffRes = await fetchWithTimeout(`${API_BASE_URL}/api/auth/staff`);
            if (staffRes.ok) {
                const staffData = await staffRes.json();
                saveStaffToLocal(staffData);
            }
        } catch (e) {
            console.warn('Staff background sync skipped/failed:', e);
        }

        // 2. Push Pending Offline Orders to Backend
        const pendingOrders = getPendingOrders() as LocalOrder[];
        if (pendingOrders.length === 0) return;

        let token: string | null = await AsyncStorage.getItem('@auth_token');

        if (!token || token === 'offline_token') {
            console.log('No valid JWT found. Keeping orders pending.');
            return;
        }

        for (const order of pendingOrders) {
            let parsedItems = [];
            try {
                parsedItems = JSON.parse(order.items);
            } catch (jsonErr) {
                console.error(`Malformed order items JSON for order ${order.clientOrderId}. Skipping.`, jsonErr);
                continue; // Skip corrupted item to prevent blocking the rest of the queue
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            try {
                const response = await fetchWithTimeout(`${API_BASE_URL}/api/orders`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        clientOrderId: order.clientOrderId,
                        tableNumber: order.tableNumber,
                        waiterId: order.waiterId,
                        items: parsedItems,
                        totalAmount: order.totalAmount
                    })
                }, 10000);

                if (response.ok || response.status === 409) {
                    markOrderAsSynced(order.clientOrderId);
                    console.log(`Order synced/verified: ${order.clientOrderId}`);
                } else if (response.status === 401 || response.status === 403) {
                    console.warn('Auth token expired or invalid during order sync. Aborting queue.');
                    break; // Stop iterating queue if authentication fails
                } else {
                    console.warn(`Pending order ${order.clientOrderId} sync paused (Status: ${response.status})`);
                }
            } catch (e) {
                console.error(`Network interrupted during order ${order.clientOrderId} sync:`, e);
                break; // Exit loop on connection drops to avoid repeated timeout delays
            }
        }
    } catch (error) {
        console.error('Sync engine encountered an error:', error);
    } finally {
        isSyncing = false;
    }
};

export const startSyncEngine = (): void => {
    if (syncIntervalId !== null) return;
    performSync(); // Run immediately on start
    syncIntervalId = setInterval(performSync, 100000);
};

export const stopSyncEngine = (): void => {
    if (syncIntervalId !== null) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
    }
};

export const triggerSyncEngine = async (): Promise<void> => {
    console.log("Manual sync triggered...");
    await performSync();
};