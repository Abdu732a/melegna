const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');

const JWT_SECRET = process.env.JWT_SECRET;
const POS_SYNC_SECRET = process.env.POS_SYNC_SECRET;

// Cache verified JWT tokens for 5 minutes (TTL: 300s)
const tokenCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const verifyAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Access token is missing' });
    }

    const token = authHeader.split(' ')[1];

    // 1. Check for POS Sync Secret (Offline Sync Fallback Key)
    if (token === POS_SYNC_SECRET) {
        req.user = { role: 'pos_device', isOfflineSync: true };
        return next();
    }

    // 2. Check fast in-memory cache first
    const cachedUser = tokenCache.get(token);
    if (cachedUser) {
        req.user = cachedUser;
        return next();
    }

    // 3. Verify standard JWT token
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        tokenCache.set(token, decoded); // Cache decoded payload
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
    }
};

module.exports = verifyAuth;