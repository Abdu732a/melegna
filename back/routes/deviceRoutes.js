const express = require('express');
const router = express.Router();
const { Device } = require('../models');
const verifyAdmin = require('../middleware/verifyAdmin');

/**
 * @route   POST /api/device/generate-key
 * @desc    Admin endpoint to seed/create new license keys in MongoDB
 * @access  Private / Admin Protected
 */
router.post('/generate-key', verifyAdmin, async (req, res) => {
    const { keyString, deviceName } = req.body;

    if (!keyString) {
        return res.status(400).json({ error: 'License key string is required.' });
    }

    try {
        const existingKey = await Device.findOne({ licenseKey: keyString });
        if (existingKey) {
            return res.status(400).json({ error: 'License key already exists in database.' });
        }

        const newDevice = await Device.create({
            licenseKey: keyString.trim().toUpperCase(),
            deviceName: deviceName || 'Unassigned Terminal',
            isActivated: false,
        });

        return res.status(201).json({
            success: true,
            message: 'License key created successfully.',
            data: newDevice,
        });
    } catch (error) {
        return res.status(500).json({ error: 'Server error during key generation.', details: error.message });
    }
});

/**
 * @route   POST /api/device/activate
 * @desc    Client POS terminal activation endpoint
 * @access  Public
 */
router.post('/activate', async (req, res) => {
    const { licenseKey, deviceId, deviceName } = req.body;

    if (!licenseKey || !deviceId) {
        return res.status(400).json({ error: 'License key and Device ID are required.' });
    }

    try {
        const normalizedKey = licenseKey.trim().toUpperCase();
        const device = await Device.findOne({ licenseKey: normalizedKey });

        if (!device) {
            return res.status(404).json({ error: 'Invalid License Key.' });
        }

        // Allow re-linking if app was re-installed on same hardware deviceId
        if (device.isActivated && device.deviceId !== deviceId) {
            return res.status(403).json({ error: 'This License Key is already bound to another device.' });
        }

        device.isActivated = true;
        device.deviceId = deviceId;
        device.deviceName = deviceName || device.deviceName || 'POS Terminal';
        device.activatedAt = new Date();
        await device.save();

        return res.status(200).json({
            success: true,
            message: 'Device authorized successfully.',
            posSyncSecret: process.env.POS_SYNC_SECRET
        });
    } catch (error) {
        return res.status(500).json({ error: 'Server error during activation.' });
    }
});

module.exports = router;