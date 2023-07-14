const mongoose = require('mongoose');

module.exports = mongoose.Schema({
    type: {
        type: String,
        required: true,
        default: 'user',
        index: true
    },
    payload: {
        type: Map,
        required: true,
        index: true
    }
}, { timestamps: true });