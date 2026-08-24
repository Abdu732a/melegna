import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import { NetPrinter, BLEPrinter, USBPrinter } from 'react-native-thermal-receipt-printer';

export interface PrinterConfig {
    method: 'LAN' | 'BLUETOOTH' | 'USB';
    address: string;
    port?: number;
}

const PRINTER_STORAGE_KEY = '@restaurant_printer_config';

const defaultConfig: PrinterConfig = {
    method: 'LAN',
    address: '192.168.1.100:9100',
    port: 9100,
};

/**
 * Ensures required Android runtime permissions are granted before calling 
 * native Bluetooth/USB APIs to prevent SecurityException crashes on Android 12+.
 */
async function ensurePermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
        if (Platform.Version >= 31) {
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            ]);

            const isConnectGranted =
                granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
                PermissionsAndroid.RESULTS.GRANTED;
            const isScanGranted =
                granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
                PermissionsAndroid.RESULTS.GRANTED;

            return isConnectGranted && isScanGranted;
        } else {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
    } catch (error) {
        console.error('Failed to request printer permissions:', error);
        return false;
    }
}

export async function getPrinterSettings(): Promise<PrinterConfig> {
    try {
        const jsonValue = await AsyncStorage.getItem(PRINTER_STORAGE_KEY);
        return jsonValue != null ? JSON.parse(jsonValue) : defaultConfig;
    } catch (error) {
        console.error('Failed to fetch printer settings from storage:', error);
        return defaultConfig;
    }
}

export async function savePrinterSettings(config: PrinterConfig): Promise<void> {
    try {
        const jsonValue = JSON.stringify(config);
        await AsyncStorage.setItem(PRINTER_STORAGE_KEY, jsonValue);
    } catch (error) {
        console.error('Failed to save printer settings to storage:', error);
    }
}

export async function connectAndPrint(
    method: 'LAN' | 'BLUETOOTH' | 'USB',
    address: string,
    payload: string
): Promise<void> {
    try {
        if (method === 'LAN') {
            if (!address) {
                throw new Error('Printer address is required for LAN connection.');
            }

            const [host, portStr] = address.split(':');
            const port = portStr ? parseInt(portStr, 10) : 9100;

            await NetPrinter.init();
            await NetPrinter.connectPrinter(host, port);
            await NetPrinter.printBill(payload);

        } else if (method === 'BLUETOOTH') {
            const hasPermission = await ensurePermissions();
            if (!hasPermission) {
                throw new Error('Bluetooth permission denied by user.');
            }

            if (!address) {
                throw new Error('MAC address is required for Bluetooth connection.');
            }

            await BLEPrinter.init();
            await BLEPrinter.connectPrinter(address);
            await BLEPrinter.printBill(payload);

        } else if (method === 'USB') {
            const hasPermission = await ensurePermissions();
            if (!hasPermission) {
                throw new Error('USB hardware permission denied by user.');
            }

            const [vendorId, productId] = address.split(':');
            await USBPrinter.init();
            await USBPrinter.connectPrinter(vendorId || '', productId || '');
            await USBPrinter.printBill(payload);
        }
    } catch (error) {
        console.error(`Failed to execute printing via ${method}:`, error);
        throw error;
    }
}

export const ClientPrinterService = {
    async printRawReceipt(payload: string): Promise<void> {
        const config = await getPrinterSettings();
        await connectAndPrint(config.method, config.address, payload);
    },
};