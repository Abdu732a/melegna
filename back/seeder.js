const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();
const User = require('./models/User');

// Helper to generate SHA-256 PIN hash
const hashPin = (pin) => {
    return crypto.createHash('sha256').update(pin).digest('hex');
};

const seedUsers = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB for seeding...');

        // Clear existing users


        const defaultPinHash = hashPin('1234'); // Default PIN: 1234

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
                passwordHash: 'hashed_password_here', // For web login
                pinCodeHash: defaultPinHash,
                salaryAmount: 6000,
                isActive: true,
                email: 'manger2@gmail.com'
            }
        ];

        await User.insertMany(usersToSeed);
        console.log('Successfully seeded waiters: Abdu and Yosef!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error.message);
        process.exit(1);
    }
};

seedUsers();