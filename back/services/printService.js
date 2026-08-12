const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;
const Order = require('../models/Order');

exports.printOrderTicket = async (savedOrderDoc) => {
    try {
        let printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: 'tcp://192.168.1.250:9100', // Update to your LAN printer IP
            characterSet: 'SLOVENIA',
            removeSpecialCharacters: false,
            options: {
                timeout: 3000,
            }
        });

        let isConnected = await printer.isPrinterConnected();
        if (!isConnected) {
            console.error('Printer not reachable on LAN IP 192.168.1.250');
            return false;
        }

        // Print header layout
        printer.alignCenter();
        printer.bold(true);
        printer.println('MELEGNA CAFE POS');
        printer.bold(false);
        printer.println(`Table: ${savedOrderDoc.tableNumber}`);
        printer.println(`Order ID: ${savedOrderDoc.clientOrderId.slice(0, 8)}`);
        printer.println('--------------------------------');

        printer.alignLeft();
        savedOrderDoc.items.forEach(item => {
            printer.table([
                `${item.quantity}x ${item.name}`,
                `${item.unitPrice * item.quantity} ETB`
            ]);
        });

        printer.println('--------------------------------');
        printer.alignRight();
        printer.bold(true);
        printer.println(`TOTAL: ${savedOrderDoc.totalAmount} ETB`);
        printer.bold(false);

        printer.alignCenter();
        printer.println('AMEN / THANK YOU!');
        printer.cut();

        // Send payload via TCP socket to hardware printer
        await printer.execute();
        console.log('Print job sent successfully to LAN printer.');

        // ✅ FIXED: Accurately update the MongoDB document using its true `_id`
        await Order.findByIdAndUpdate(savedOrderDoc._id, { status: 'IN_KITCHEN' });
        console.log(`Order ${savedOrderDoc._id} status updated to IN_KITCHEN`);

        return true;
    } catch (error) {
        console.error('Print execution failed or network timeout:', error);
        return false;
    }
};