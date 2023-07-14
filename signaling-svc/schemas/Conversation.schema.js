const mongoose 			= require('mongoose');

module.exports = mongoose.Schema({
    title: {
        type: String,
        required: false
    },
    custom_title: {
        type: Boolean,
        default: false
    },
    archived: {
        type: Boolean,
        default: false
    },
    participants: {
        type: Array
    },
    last_message: {
        type: String
    },
    last_message_from: {
        type: String
    },
    last_message_time: {
        type: Date
    },
    last_message_type: {
        type: String
    }
}, {timestamps: true});
