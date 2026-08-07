import { getLocalDatabase } from '../database/sqlite';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

let isSyncing = false;

/**
 * Reads pending orders from the local SQLite sync_queue table
 * and attempts to upload them to the Node.js backend.
 */
export async function triggerSyncEngine(): Promise<void> {
    if (isSyncing) return;
    isSyncing = true;

    try {
        const db = await getLocalDatabase();

        // Get all orders waiting to be synced (up to 10 retries)
        const pendingItems = await db.getAllAsync<{
            id: string;
            client_order_id: string;
            payload: string;
            retry_count: number;
        }>(
            `SELECT id, client_order_id, payload, retry_count
             FROM sync_queue
             WHERE sync_status IN ('PENDING', 'FAILED') AND retry_count < 10
             ORDER BY created_at ASC`
        );

        for (const item of pendingItems) {
            try {
                // Mark item as IN_PROGRESS during upload attempt
                await db.runAsync(
                    'UPDATE sync_queue SET sync_status = ? WHERE id = ?',
                    ['IN_PROGRESS', item.id]
                );

                const payloadData = JSON.parse(item.payload);

                const response = await fetch(`${API_BASE_URL}/api/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadData),
                });

                if (response.ok) {
                    // Transactionally mark sync_queue and order as SYNCED
                    await db.execAsync('BEGIN IMMEDIATE;');
                    await db.runAsync(
                        'UPDATE sync_queue SET sync_status = ? WHERE id = ?',
                        ['SYNCED', item.id]
                    );
                    await db.runAsync(
                        'UPDATE orders SET status = ? WHERE client_order_id = ?',
                        ['SYNCED', item.client_order_id]
                    );
                    await db.execAsync('COMMIT;');
                } else {
                    throw new Error(`Server returned HTTP ${response.status}`);
                }
            } catch (err: any) {
                const nextRetry = item.retry_count + 1;
                await db.runAsync(
                    `UPDATE sync_queue 
                     SET sync_status = ?, retry_count = ?, last_attempt = ? 
                     WHERE id = ?`,
                    ['FAILED', nextRetry, Date.now(), item.id]
                );
            }
        }
    } catch (error) {
        console.error('[SyncEngine] Error during queue processing:', error);
    } finally {
        isSyncing = false;
    }
}