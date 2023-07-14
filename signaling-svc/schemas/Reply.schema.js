const mongoose 			= require('mongoose');
const attachment = require('./Attachment.schema');

module.exports = mongoose.Schema({
    author: { type: String, ref: 'User'},
    post:  { type: String, ref: 'Post' },
    likes: {  
        type: Array,
        required: false
    },
    dislikes:  {  
        type: Array,
        required: false
    },
    children: {
        type: [ {
          type: String,
          ref: 'Reply',
        }],
        default: [],
      },
    message: {
        type: String,
        required: true,
        trim: true
    },
    attachments: [ attachment ],
    parent_id: {
        type: String,
        required: false,
        default: "0"
    },
    reply_type: {
        type: String,
        required: true
    }
}, {timestamps: true});