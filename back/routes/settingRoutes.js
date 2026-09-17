const express = require('express');
const router = express.Router();
const { getSettingByKey } = require('../controllers/settingController');

// GET /api/settings/:key
router.get('/:key', getSettingByKey);

module.exports = router;
