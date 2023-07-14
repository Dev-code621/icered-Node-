const mongoose = require('mongoose');

module.exports = mongoose.Schema({
    userID: String,
    approved: {
        type: Boolean,
        default: false
    },
    answered: {
        type: Boolean,
        default: false
    }
})

