const mongoose = require('mongoose');
require('dotenv').config();
const MenuItem = require('./models/MenuItem');

const seedMenu = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for menu seeding...');

        await MenuItem.deleteMany({});
        console.log('Cleared existing menu items.');

        const items = [
            // FOOD (ምግብ)
            {
                nameAmharic: 'በየአይነቱ (Special Beyaynetu)',
                nameEnglish: 'Special Beyaynetu',
                category: 'FOOD',
                price: 250,
                imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
                isAvailable: true,
            },
            {
                nameAmharic: 'የበሬ ጥብስ (Beef Tibs)',
                nameEnglish: 'Beef Tibs',
                category: 'FOOD',
                price: 380,
                imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400',
                isAvailable: true,
            },
            {
                nameAmharic: 'ዶሮ ወጥ (Doro Wot)',
                nameEnglish: 'Doro Wot',
                category: 'FOOD',
                price: 450,
                imageUrl: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400',
                isAvailable: true,
            },
            {
                nameAmharic: 'ቡርገር ከፍራይስ ጋር (Burger with Fries)',
                nameEnglish: 'Burger with Fries',
                category: 'FOOD',
                price: 320,
                imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
                isAvailable: true,
            },

            // DRINK (መጠጥ)
            {
                nameAmharic: 'ስፕሪስ ቡና (Espresso / Macchiato)',
                nameEnglish: 'Macchiato',
                category: 'DRINK',
                price: 50,
                imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400',
                isAvailable: true,
            },
            {
                nameAmharic: 'የፍራፍሬ ስፕሪስ (Special Juice Spris)',
                nameEnglish: 'Mixed Fruit Juice',
                category: 'DRINK',
                price: 120,
                imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400',
                isAvailable: true,
            },
            {
                nameAmharic: 'ጥቁር ሻይ (Black Tea)',
                nameEnglish: 'Black Tea',
                category: 'DRINK',
                price: 30,
                imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400',
                isAvailable: true,
            },

            // DESSERT (ጣፋጭ)
            {
                nameAmharic: 'ቲራሚሱ (Tiramisu)',
                nameEnglish: 'Tiramisu',
                category: 'DESSERT',
                price: 180,
                imageUrl: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400',
                isAvailable: true,
            },
            {
                nameAmharic: 'አይስ ክሬም (Vanilla Ice Cream)',
                nameEnglish: 'Ice Cream',
                category: 'DESSERT',
                price: 100,
                imageUrl: 'https://images.unsplash.com/photo-1560008511-11c63416e52d?w=400',
                isAvailable: true,
            },

            // OTHER (ሌሎች)
            {
                nameAmharic: 'የታሸገ ውሃ (Bottled Water 1L)',
                nameEnglish: 'Bottled Water 1L',
                category: 'OTHER',
                price: 40,
                imageUrl: '',
                isAvailable: true,
            },
        ];

        await MenuItem.insertMany(items);
        console.log('Menu items successfully seeded!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

seedMenu();