const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    notes: { type: String, default: '' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    clientOrderId: { type: String, required: true, unique: true, index: true },
    tableNumber: { type: String, required: true },
    waiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    status: {
        type: String,
        enum: ['SUBMITTED', 'IN_KITCHEN', 'PAID', 'CANCELLED'],
        default: 'SUBMITTED'
    },
    isPaid: { type: Boolean, default: false },
    paymentMethod: { type: String, enum: ['CASH', 'CARD', 'MOBILE', 'NONE'], default: 'NONE' },
    cancellationReason: { type: String, default: '' },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);