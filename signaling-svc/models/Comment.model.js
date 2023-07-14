const mongoose 			= require('mongoose');

const comment = require('../schemas/Comment.schema');
const subscription = require('../schemas/Subscription.schema');

const CommentSchema = mongoose.Schema({
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
    subscriptions: [ subscription ],

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
    created_at: {
        type: String
    },
    likes: {  
        type: Array,
    },
    author:{
        type:Object
    },
    replyComments: [comment],

}, { timestamps: true });

module.exports = mongoose.model('comment', CommentSchema);
