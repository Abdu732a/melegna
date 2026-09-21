require('dotenv').config(); // MUST BE LINE 1

const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// 1. Security Headers
app.use(helmet());

// 2. Body Parser (Payload size limiter)
app.use(express.json({ limit: '10kb' }));

// 3. Rate Limiters (Mounted BEFORE all /api routes)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // 15 ደቂቃ ውስጥ እስከ 1000 ጥያቄዎች (ለ Sync Engine በቂ ነው)
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30, // ለ Auth እና Device Activation ጥብቅ ገደብ
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please try again later.' },
});

// Rate Limiters 
app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/device', authLimiter);

// 4. Root & Health Check Endpoints
app.get('/', (req, res) => {
    res.status(200).send('Melegna POS API is running live!');
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', uptime: process.uptime(), timestamp: new Date() });
});

// 5. API Routes
app.use('/api/device', require('./routes/deviceRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/menu', require('./routes/menuRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));

// 6. Global 404 Route Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// 7. Global Error Handler Middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// 8. Mongoose & Server Connection
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

if (!MONGO_URI) {
    console.error('CRITICAL ERROR: MONGO_URI environment variable is missing.');
    process.exit(1);
}

const mongooseOptions = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
};

mongoose
    .connect(MONGO_URI, mongooseOptions)
    .then(() => {
        console.log(' Connected to MongoDB Atlas with Connection Pooling!');
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
    });