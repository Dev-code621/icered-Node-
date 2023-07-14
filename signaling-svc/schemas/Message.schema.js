const mongoose 			= require('mongoose');
const attachment = require('./Attachment.model')

module.exports = mongoose.Schema({
    author: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    attachments: [ attachment ],
    date: {
        type: Date,
        default: Date.now()
    }
}, {timestamps: true});
