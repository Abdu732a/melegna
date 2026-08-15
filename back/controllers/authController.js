const { User } = require('../models');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '12h'; // POS session duration

// Helper to generate SHA-256 PIN hash
const hashPin = (pin) => {
    return crypto.createHash('sha256').update(pin).digest('hex');
};

// GET /api/auth/staff - Public endpoint to list active staff with pagination & lean execution
exports.getActiveStaff = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const page = Math.max(parseInt(req.query.page) || 1, 1);

        const staff = await User.find({ isActive: true })
            .select('_id name role')
            .limit(limit)
            .skip((page - 1) * limit)
            .lean();

        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/auth/verify-pin - Issues JWT Token upon successful verification
exports.verifyPin = async (req, res) => {
    try {
        const { userId, pinCode } = req.body;

        if (!userId || !pinCode) {
            return res.status(400).json({ error: 'User ID and PIN code are required' });
        }

        const user = await User.findById(userId).lean();
        if (!user || !user.isActive) {
            return res.status(404).json({ error: 'User not found or inactive' });
        }

        const hashedInputPin = hashPin(pinCode);

        if (user.pinCodeHash !== hashedInputPin) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        // Generate JWT token containing staff identity
        const token = jwt.sign(
            { id: user._id, _id: user._id, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Fixed `_id` and `id` unified payload output
        res.json({
            message: 'PIN verified successfully',
            token,
            user: {
                _id: user._id,
                id: user._id,
                name: user.name,
                role: user.role,
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};