const mongoose 			= require('mongoose');
const interest = require('../schemas/Interest.schema');
const post = require('../schemas/Post.schema');
const userRef = require('../schemas/User.ref.schema');

module.exports = mongoose.model('topic', mongoose.Schema({
    title: {
        type: String,
        required: true,
        index: true,
        trim: true
    },
    author: {
        type: String,
        required: true,
        index: true
    },
    slug: {
        type: String,
        unique: true,
        index: true,
        trim: true
    },
    interests: [ interest ],
    original_post: {
        type: String,
        required: true
    },
    comments: [ comment ],
    subscribers: [ userRef ]
}, {timestamps: true}));
