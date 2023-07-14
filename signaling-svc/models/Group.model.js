const mongoose 			= require('mongoose');

module.exports = mongoose.model('group', mongoose.Schema({
    title: {
        type: String,
        index: true,
        required: true
    },
    slug: {
        type: String,
        index: true,
        required: true,
        trim: true
    },
    date: {
        type: Date,
        default: Date.now()
    }
}, {timestamps: true}));
