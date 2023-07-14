const mongoose 			= require('mongoose');

module.exports = mongoose.Schema({
    user_id: {
        type: String,
        required: true,
        index: true
    },
    platform: {
        type: String,
        required: true,
        index: true
    }
}, {timestamps: true});