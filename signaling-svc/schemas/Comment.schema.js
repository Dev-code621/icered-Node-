const mongoose 			= require('mongoose');
const validate          = require('mongoose-validator');

module.exports = mongoose.Schema({

    post_id: {
        type: String
    },
    news_id:{
        type: String,
        default: ""
    },
    commmenter_user_id: {
        type: String
    },
    comment: {
        type: String        
    },
    content_type: {
        type: String
    },
    data: {
        type: String
    },
    level: {
        type: Number
    },
    parent_comment_id: {
        type: String
    },
    commenter_user_name: {
        type: String
    },
    commenter_user_pic: {
        type: String
    },
    comment_type: {
        type: String
    },
    likes: {  
        type: Array,
    },
    author:{
        type:Object
    },
    created_at: {
        type: String
    }

}, { timestamps: true });
