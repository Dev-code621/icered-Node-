const mongoose = require('mongoose');

module.exports = mongoose.Schema({
    reason: {
        type: String,
        required: true
    },
    warned_by: {
        type: String,
        required: true
    }
}, { timestamps: true });