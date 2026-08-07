import TcpSocket from 'react-native-tcp-socket';

// Replace with your actual local static IP for the cafe's thermal printer
const PRINTER_IP = '192.168.1.100';
const PRINTER_PORT = 9100;

export const ClientPrinterService = {
    /**
     * Prints a pre-formatted ESC/POS raw string (used in checkout.tsx)
     */
    printRawReceipt: (rawReceipt: string): Promise<boolean> => {
        return new Promise((resolve) => {
            console.log(`Attempting to connect to LAN printer at ${PRINTER_IP}:${PRINTER_PORT}...`);

            const client = TcpSocket.createConnection({
                host: PRINTER_IP,
                port: PRINTER_PORT,
            }, () => {
                // Connection successful, write the raw ESC/POS payload
                client.write(rawReceipt);
                client.end();
                resolve(true);
            });

            client.on('error', (error) => {
                console.error('Local printer connection error:', error);
                client.destroy();
                resolve(false);
            });

            // Fallback timeout just in case the socket hangs
            setTimeout(() => {
                client.destroy();
                resolve(false);
            }, 5000);
        });
    },

    /**
     * Optional: Prints by accepting an object instead of a raw string. 
     * Useful if you want to trigger custom prints outside of the checkout page.
     */
    printKitchenReceipt: (orderDetails: any): Promise<boolean> => {
        const ESC = '\x1B';
        const INIT = `${ESC}@`;
        const CENTER = `${ESC}a\x01`;
        const LEFT = `${ESC}a\x00`;
        const CUT = '\x1D\x56\x41\x10';

        let printData = `${INIT}${CENTER}=== KITCHEN ORDER ===\n`;
        printData += `Table: ${orderDetails.tableNumber}\n`;
        printData += `Order ID: ${orderDetails.clientOrderId}\n`;
        printData += `--------------------------------\n${LEFT}`;

        for (const item of orderDetails.items) {
            printData += `${item.quantity}x ${item.name}\n`;
            if (item.notes) printData += `   Note: ${item.notes}\n`;
        }

        printData += `--------------------------------\n\n${CUT}`;

        return ClientPrinterService.printRawReceipt(printData);
    }
};