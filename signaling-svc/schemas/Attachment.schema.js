const mongoose 			= require('mongoose');
const validate          = require('mongoose-validator');

module.exports = mongoose.Schema({
    author: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    data: {
        type: String,
        required: true
    }
}, {timestamps: true});
