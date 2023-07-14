const mongoose 			= require('mongoose');

module.exports = mongoose.Schema({
    userId: {
        type: String,
        // required: true,
        // unique: true
    },
    hidden: {
        type: Boolean,
        default: false
    }
}, {timestamps: true});
