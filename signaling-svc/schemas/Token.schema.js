const mongoose = require('mongoose');

module.exports = mongoose.Schema({
    token: {
        type: String,
        required: true
    },
    linked_token: {
        type: String,
        required: false
    },
    expires: {
        type: Date,
        required: false
    }
}, { timestamps: true });