import TcpSocket from 'react-native-tcp-socket';

// Standard ESC/POS commands formatting for thermal printers
export const printKitchenReceipt = (printerIp: string, printerPort: number, orderDetails: any) => {
    const client = TcpSocket.createConnection({
        host: printerIp,
        port: printerPort || 9100, // Standard raw printing port
    }, () => {
        // ESC/POS Byte commands
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

        client.write(printData);
        client.end();
    });

    client.on('error', (error) => {
        console.error('Local printer connection error:', error);
    });
};