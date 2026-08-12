const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const verifyAuth = require('../middleware/authMiddleware');

router.post('/', verifyAuth, orderController.createOrder);
router.get('/', verifyAuth, orderController.getOrders);

module.exports = router;