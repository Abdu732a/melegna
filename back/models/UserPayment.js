const mongoose = require('mongoose');

const userPaymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    paymentDate: { type: Date, default: Date.now },
    periodMonth: { type: Number, required: true, min: 1, max: 12 },
    periodYear: { type: Number, required: true },
    baseSalary: { type: Number, required: true },
    paidAmount: { type: Number, required: true },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Ensure an employee is only paid once per month/year period
userPaymentSchema.index({ userId: 1, periodMonth: 1, periodYear: 1 }, { unique: true });

module.exports = mongoose.model('UserPayment', userPaymentSchema);