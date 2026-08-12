const MenuItem = require('../models/MenuItem');

// GET /api/menu - Public (or protected if preferred)
exports.getMenuItems = async (req, res) => {
    try {
        const items = await MenuItem.find({});
        res.status(200).json(items);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch menu items' });
    }
};

// POST /api/menu - Requires Auth
exports.createMenuItem = async (req, res) => {
    try {
        const newItem = new MenuItem(req.body);
        const savedItem = await newItem.save();
        res.status(201).json(savedItem);
    } catch (error) {
        res.status(400).json({ error: 'Failed to create menu item' });
    }
};