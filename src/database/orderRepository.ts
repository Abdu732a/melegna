import { Platform } from 'react-native';
import db from './sqlite';

export const createLocalOrder = (orderData: {
    clientOrderId: string;
    tableNumber: string;
    waiterId: string;
    items: any[];
    totalAmount: number;
}) => {
    if (Platform.OS === 'web') {
        try {
            const existingOrders = JSON.parse(localStorage.getItem('@local_orders') || '[]');
            const newOrder = {
                ...orderData,
                items: JSON.stringify(orderData.items),
                status: 'SUBMITTED',
                isPaid: 0,
                paymentMethod: 'NONE',
                synced: 0
            };
            existingOrders.push(newOrder);
            localStorage.setItem('@local_orders', JSON.stringify(existingOrders));
            return true;
        } catch (e) {
            console.error('Failed to save order to localStorage on web:', e);
            return false;
        }
    }

    if (!db) return false;

    const statement = db.prepareSync(`
        INSERT INTO local_orders (clientOrderId, tableNumber, waiterId, items, totalAmount, status, isPaid, paymentMethod, synced)
        VALUES (?, ?, ?, ?, ?, 'SUBMITTED', 0, 'NONE', 0)
    `);

    try {
        statement.executeSync([
            orderData.clientOrderId,
            orderData.tableNumber,
            orderData.waiterId,
            JSON.stringify(orderData.items),
            orderData.totalAmount
        ]);
        return true;
    } catch (error) {
        console.error('Failed to save order locally:', error);
        return false;
    } finally {
        statement.finalizeSync();
    }
};

export const getPendingOrders = (): any[] => {
    if (Platform.OS === 'web') {
        try {
            const orders = JSON.parse(localStorage.getItem('@local_orders') || '[]');
            return orders.filter((o: any) => o.synced === 0);
        } catch (e) {
            return [];
        }
    }

    if (!db) return [];
    return db.getAllSync('SELECT * FROM local_orders WHERE synced = 0');
};

export const markOrderAsSynced = (clientOrderId: string) => {
    if (Platform.OS === 'web') {
        try {
            const orders = JSON.parse(localStorage.getItem('@local_orders') || '[]');
            const updated = orders.map((o: any) =>
                o.clientOrderId === clientOrderId ? { ...o, synced: 1 } : o
            );
            localStorage.setItem('@local_orders', JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to mark order synced on web:', e);
        }
        return;
    }

    if (!db) return;
    db.runSync('UPDATE local_orders SET synced = 1 WHERE clientOrderId = ?', [clientOrderId]);
};

// NEW: Update status to IN_KITCHEN upon successful print
export const updateOrderStatusToKitchen = (clientOrderId: string): boolean => {
    if (Platform.OS === 'web') {
        try {
            const orders = JSON.parse(localStorage.getItem('@local_orders') || '[]');
            const updated = orders.map((o: any) =>
                o.clientOrderId === clientOrderId ? { ...o, status: 'IN_KITCHEN' } : o
            );
            localStorage.setItem('@local_orders', JSON.stringify(updated));
            return true;
        } catch (e) {
            console.error('Failed to update status on web:', e);
            return false;
        }
    }

    if (!db) return false;

    try {
        db.runSync(
            'UPDATE local_orders SET status = ? WHERE clientOrderId = ?',
            ['IN_KITCHEN', clientOrderId]
        );
        return true;
    } catch (error) {
        console.error('Failed to update order status locally:', error);
        return false;
    }
};