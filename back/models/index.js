// models/index.js
const User = require('./User');
const MenuItem = require('./MenuItem');
const Order = require('./Order');
const Attendance = require('./Attendance');
const UserPayment = require('./UserPayment');
const Device = require('./Device'); // <--- Added Device Model

module.exports = {
    User,
    MenuItem,
    Order,
    Attendance,
    UserPayment,
    Device, // <--- Exported here
};