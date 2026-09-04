const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    licenseKey: { type: String, required: true, unique: true },
    deviceId: { type: String, default: null }, // Linked to unique hardware ID upon activation
    deviceName: { type: String, default: '' },
    isActivated: { type: Boolean, default: false },
    activatedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Device', deviceSchema);