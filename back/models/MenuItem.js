const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
    nameAmharic: { type: String, required: true },
    nameEnglish: { type: String, required: true },
    category: {
        type: String,
        enum: ['FOOD', 'DRINK', 'DESSERT', 'OTHER'],
        required: true,
    },
    price: { type: Number, required: true },
    imageUrl: { type: String, default: '' }, // Optional image URL
    isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);