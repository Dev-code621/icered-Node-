const mongoose 			= require('mongoose');

const userRef = require('../schemas/User.ref.schema.js');

const interest = mongoose.Schema({
    label: {
        type: String,
        required: true
    },
    image_url:{
        type: String,
        default: ""
    },
    description: {
        type: String,
        required: true
    },
    subscribers: [ userRef ],
    slug: {
        type: String,
        unique: true,
        required: true
    },
    category: {
        type: String,
        default: 'work'
    },
    news_category: {
        type: String
    },
    parents: [String],
    type: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('interest', interest);
