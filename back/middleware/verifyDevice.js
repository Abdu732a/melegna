const Device = require('../models/Device');

const verifyDeviceToken = async (req, res, next) => {
    const clientSecret = req.headers['x-pos-sync-secret'];
    const deviceId = req.headers['x-device-id'];

    if (!clientSecret || clientSecret !== process.env.POS_SYNC_SECRET) {
        return res.status(403).json({ error: 'Access Denied: Invalid Sync Signature' });
    }

    if (!deviceId) {
        return res.status(401).json({ error: 'Access Denied: Missing Device Identification' });
    }

    const registeredDevice = await Device.findOne({ deviceId, isActivated: true });
    if (!registeredDevice) {
        return res.status(403).json({ error: 'Access Denied: Unregistered or Deactivated Device' });
    }

    req.device = registeredDevice;
    next();
};

module.exports = verifyDeviceToken;