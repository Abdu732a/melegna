import db from './sqlite';

export const createLocalOrder = (orderData: {
    clientOrderId: string;
    tableNumber: string;
    waiterId: string;
    items: any[];
    totalAmount: number;
}) => {
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

export const getPendingOrders = () => {
    return db.getAllSync('SELECT * FROM local_orders WHERE synced = 0');
};

export const markOrderAsSynced = (clientOrderId: string) => {
    db.runSync('UPDATE local_orders SET synced = 1 WHERE clientOrderId = ?', [clientOrderId]);
};