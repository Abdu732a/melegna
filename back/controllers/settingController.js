const mongoose = require('mongoose');

// @desc    Get a setting by key from the system_settings collection
// @route   GET /api/settings/:key
// @access  Public (or Private depending on your auth middleware)
exports.getSettingByKey = async (req, res) => {
    try {
        const key = req.params.key;
        const setting = await mongoose.connection.db.collection('system_settings').findOne({ key });
        
        if (!setting) {
            return res.status(404).json({ success: false, message: 'Setting not found' });
        }

        res.status(200).json(setting);
    } catch (error) {
        console.error(`Error fetching setting for key ${req.params.key}:`, error);
        res.status(500).json({ success: false, message: 'Server error fetching setting' });
    }
};
