const crypto = require('crypto');
const Device = require('../models/Device');

const verifyDeviceToken = async (req, res, next) => {
    try {
        const clientSecret = req.headers['x-pos-sync-secret'];
        const deviceId = req.headers['x-device-id'];
        const serverSecret = process.env.POS_SYNC_SECRET;

        // 1. Guard against missing environment configuration
        if (!serverSecret) {
            console.error('CRITICAL: POS_SYNC_SECRET is missing from server environment variables.');
            return res.status(500).json({ error: 'Internal server security error' });
        }

        // 2. Header presence validation
        if (!clientSecret) {
            return res.status(403).json({ error: 'Access Denied: Missing Sync Signature' });
        }

        if (!deviceId) {
            return res.status(401).json({ error: 'Access Denied: Missing Device Identification' });
        }

        // 3. Timing-safe comparison to prevent timing attacks
        const clientSecretBuffer = Buffer.from(String(clientSecret));
        const serverSecretBuffer = Buffer.from(serverSecret);

        if (
            clientSecretBuffer.length !== serverSecretBuffer.length ||
            !crypto.timingSafeEqual(clientSecretBuffer, serverSecretBuffer)
        ) {
            return res.status(403).json({ error: 'Access Denied: Invalid Sync Signature' });
        }

        // 4. Database verification with error handling
        const registeredDevice = await Device.findOne({ deviceId, isActivated: true }).exec();

        if (!registeredDevice) {
            return res.status(403).json({ error: 'Access Denied: Unregistered or Deactivated Device' });
        }

        // 5. Attach device object to request state
        req.device = registeredDevice;
        next();
    } catch (error) {
        console.error('Device Verification Middleware Error:', error);
        return res.status(500).json({ error: 'Authentication service unavailable' });
    }
};

module.exports = verifyDeviceToken;