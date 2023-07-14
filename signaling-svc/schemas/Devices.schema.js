const mongoose 			= require('mongoose');

module.exports = mongoose.Schema({
    name: {
        type: String,
        required: true,
        index: true
    },
    token: {
        type: String,
        required: true
    },
    deviceUDID: {
        type: String,
    },
    platform: {
        type: String,
        default: 'iOS'
    }
}, {timestamps: true});