import TcpSocket from 'react-native-tcp-socket';
import { getLocalDatabase } from '../database/sqlite';

export interface PrinterConfig {
    type: 'LAN' | 'USB';
    ipAddress?: string;
    port?: number;
}

export class ClientPrinterService {
    public static async printRawReceipt(rawData: string): Promise<boolean> {
        const db = await getLocalDatabase();
        const configRow = await db.getFirstAsync<{ value: string }>(
            'SELECT value FROM settings WHERE key = ?',
            ['printer_config']
        );

        if (!configRow) {
            throw new Error('PrinterNotConfigured: Set printer IP in settings.');
        }

        const config: PrinterConfig = JSON.parse(configRow.value);

        if (config.type === 'LAN') {
            return new Promise((resolve, reject) => {
                const client = TcpSocket.createConnection(
                    { host: config.ipAddress, port: config.port || 9100, timeout: 4000 },
                    () => {
                        client.write(rawData, 'utf8', () => {
                            client.destroy();
                            resolve(true);
                        });
                    }
                );

                client.on('error', (err) => {
                    client.destroy();
                    reject(err);
                });
            }
            );
        }

        // Default fallback
        return false;
    }
}