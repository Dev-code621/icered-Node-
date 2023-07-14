const mongoose 			= require('mongoose');

module.exports = mongoose.model('invite', mongoose.Schema({
    from_uid: {
        type: String,
        required: true
    },
    to_phone: {
        type: String,
        required: true
    },
    complete: {
        type: Boolean,
        default: false
    },
    date: {
        type: Date,
        default: Date.now()
    }
}, {timestamps: true}));
