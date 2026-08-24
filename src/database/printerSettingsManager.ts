import AsyncStorage from '@react-native-async-storage/async-storage';
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

export async function connectAndPrint(method: 'LAN' | 'BLUETOOTH' | 'USB', address: string, payload: string) {
    if (method === 'LAN') {
        const [host, portStr] = address.split(':');
        const port = portStr ? parseInt(portStr, 10) : 9100;

        await NetPrinter.init();
        await NetPrinter.connectPrinter(host, port);
        await NetPrinter.printText(payload);
    } else if (method === 'BLUETOOTH') {
        await BLEPrinter.init();
        await BLEPrinter.connectPrinter(address);
        await BLEPrinter.printText(payload);
    } else if (method === 'USB') {
        const [vendorId, productId] = address.split(':');
        await USBPrinter.init();
        await USBPrinter.connectPrinter(vendorId || '', productId || '');
        await USBPrinter.printText(payload);
    }
}