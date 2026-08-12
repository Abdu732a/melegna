const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    role: {
        type: String,
        enum: ['OWNER', 'MANAGER', 'CASHIER', 'WAITER', 'COOKER', 'BARISTA'],
        required: true
    },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, required: true },
    passwordHash: { type: String }, // Used for Web Dashboard login (Managers/Owners)
    pinCodeHash: { type: String, required: true }, // SHA-256 Hash for Mobile PIN login
    salaryAmount: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true } // Soft delete flag
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);