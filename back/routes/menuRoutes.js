const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const verifyAuth = require('../middleware/authMiddleware');

router.get('/', menuController.getMenuItems);
router.post('/', verifyAuth, menuController.createMenuItem);

module.exports = router;