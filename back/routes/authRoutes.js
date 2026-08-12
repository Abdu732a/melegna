const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const rateLimit = require('express-rate-limit');

// Strict Rate Limiter for PIN Verification: Max 5 failed attempts per 15 mins per IP
const pinLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

router.get('/staff', authController.getActiveStaff);
router.post('/verify-pin', pinLimiter, authController.verifyPin);

module.exports = router;