const crypto = require('crypto');

const verifyAdmin = (req, res, next) => {
    try {
        const adminPass = req.headers['x-admin-password'];
        const serverAdminPass = process.env.ADMIN_PASSWORD;

        if (!serverAdminPass) {
            console.error('CRITICAL: ADMIN_PASSWORD is missing in server environment variables.');
            return res.status(500).json({ error: 'Internal server configuration error' });
        }

        if (!adminPass) {
            return res.status(401).json({ error: 'Access Denied: Missing Admin Password' });
        }

        const clientPassBuffer = Buffer.from(String(adminPass));
        const serverPassBuffer = Buffer.from(serverAdminPass);

        if (
            clientPassBuffer.length !== serverPassBuffer.length ||
            !crypto.timingSafeEqual(clientPassBuffer, serverPassBuffer)
        ) {
            return res.status(403).json({ error: 'Access Denied: Invalid Admin Password' });
        }

        next();
    } catch (error) {
        console.error('Admin Verification Error:', error);
        return res.status(500).json({ error: 'Authentication check failed' });
    }
};

module.exports = verifyAdmin;