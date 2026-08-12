const Order = require('../models/Order');

// POST /api/orders - Protected
exports.createOrder = async (req, res) => {
    try {
        const { clientOrderId, tableNumber, items, totalAmount } = req.body;

        if (!clientOrderId) {
            return res.status(400).json({ error: 'clientOrderId is required for sync' });
        }

        // Trust waiterId directly from the verified token payload
        const waiterId = req.user?.id || req.body.waiterId;

        // 1. Check if order with this clientOrderId already exists
        const existingOrder = await Order.findOne({ clientOrderId });
        if (existingOrder) {
            return res.status(200).json({
                message: 'Order already processed (deduplicated)',
                order: existingOrder
            });
        }

        // 2. Persist new order
        const newOrder = new Order({
            clientOrderId,
            tableNumber,
            waiterId,
            items,
            totalAmount,
            status: 'SUBMITTED',
            isPaid: false,
            paymentMethod: 'NONE',
        });

        const savedOrder = await newOrder.save();
        res.status(201).json(savedOrder);
    } catch (error) {
        if (error.code === 11000) {
            const existingOrder = await Order.findOne({ clientOrderId: req.body.clientOrderId });
            return res.status(200).json({
                message: 'Order already synced',
                order: existingOrder
            });
        }
        console.error('Order creation error:', error);
        res.status(400).json({ error: 'Failed to place order' });
    }
};

// GET /api/orders - Protected
exports.getOrders = async (req, res) => {
    try {
        const orders = await Order.find({}).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};