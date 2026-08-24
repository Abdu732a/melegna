const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();
const User = require('./models/User');

// Helper to generate SHA-256 hash for PIN or password
const hashData = (data) => {
    return crypto.createHash('sha256').update(data).digest('hex');
};

const seedUsers = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB for seeding...');

        const defaultPinHash = hashData('1234'); // Default PIN: 1234
        const hashedPassword = hashData('12345678'); // Password for manager login

        const usersToSeed = [
            {
                name: 'kebe',
                role: 'WAITER',
                phone: '0911111111',
                pinCodeHash: defaultPinHash,
                salaryAmount: 3000,
                isActive: true,
                email: 'kebe@gmail.com'
            },
            {
                name: 'abebe',
                role: 'WAITER',
                phone: '0922222222',
                pinCodeHash: defaultPinHash,
                salaryAmount: 3000,
                isActive: true,
                email: 'abebe@gmail.com'
            },
            {
                name: 'Manager 2',
                role: 'MANAGER',
                phone: '0933333333',
                passwordHash: hashedPassword, // Using passwordHash to match schema conventions
                pinCodeHash: defaultPinHash,
                salaryAmount: 6000,
                isActive: true,
                email: 'manger2@gmail.com'
            },
            {
                name: 'Manager One',
                role: 'MANAGER',
                phone: '0944444444',
                passwordHash: hashedPassword,
                pinCodeHash: defaultPinHash,
                salaryAmount: 7000,
                isActive: true,
                email: 'manager1@melegna.com'
            }
        ];

        // Loop through and upsert so existing users are preserved
        for (const userData of usersToSeed) {
            await User.findOneAndUpdate(
                { email: userData.email },
                userData,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }

        console.log('Successfully seeded database with waiters and managers (including manager1@melegna.com)!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error.message);
        process.exit(1);
    }
};

seedUsers();