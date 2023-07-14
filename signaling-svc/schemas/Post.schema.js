const mongoose 			= require('mongoose');
const PostRef = require('./Post.ref.schema');
const attachment = require('./Attachment.schema');
const share = require('./Share.schema');


module.exports = mongoose.Schema({
    author: {
        type: String,
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    body: {
        type: String,
        required: true
    },
    type: {
        type: String
    },
    attachments: [ attachment ],
    likes: {  
        type: Array
    },
    dislikes:  {  
        type: Array
    },
    shares: [ share ],
    interest: {
        type: String,
        required: false
    },
    interests: [String],
    country_code: {
        type: Number,
        required: false,
        default: 1
    },
    tips_earned: {
        type: Number,
        default: 0
    },
    geo_longitude: {
        type: Number
    },
    geo_latitude: {
        type: Number
    },
    blockUsers: [String],
    geo_title: {
        type: String
    }

}, {timestamps: true});