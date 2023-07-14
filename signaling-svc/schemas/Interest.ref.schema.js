const mongoose 			= require('mongoose');

module.exports = mongoose.Schema({
    slug: {
        type: String,
        required: true
    }
}, { timestamps: true });