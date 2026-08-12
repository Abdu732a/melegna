const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // Stored as "YYYY-MM-DD" for easy querying
    status: {
        type: String,
        enum: ['PRESENT', 'ABSENT', 'LEAVE', 'HOLIDAY', 'HALF_DAY'],
        required: true
    },
    note: { type: String, default: '' } // e.g., "Annual leave", "Public holiday"
}, { timestamps: true });

// Prevent duplicate attendance entries for the same user on the same date
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);