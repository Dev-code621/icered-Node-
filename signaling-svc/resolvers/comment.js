const twilio = require('twilio')
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
const jwt = require('jsonwebtoken')
const randtoken = require('rand-token')
const helpers = require('../helpers')
const apollo = require('apollo-server-express')

const User = require('../models/User.model')
const Comment = require('../models/Comment.model')
const { use, authenticate } = require('passport')
const { author } = require('./user')
const { auth } = require('firebase-admin')

const checkIfUserHasInterest = helpers.checkIfUserHasInterest
const UserInputError = apollo.UserInputError
const PostModel = require('../models/Post.model');

const { 
    sendAlerts,
    sendOneAlert
} = require('../helpers/alerts.helper')

module.exports.getComments = async (parent, params, __)=> {
    let { 
        id,
        comment_type,
        sort,
        limit,
        start_at

    } = params;

    sort = ( sort == 'asc' ? 1 : -1);
    start_at = (!start_at ? 0 : start_at);
    limit = (!limit ? 0 : limit);
    let commentQuery = {};
    commentQuery['level'] = 0;
    if (comment_type == "0") {
        commentQuery['post_id'] = id;
    }else{
        commentQuery['news_id'] = id;
    }
    let result = await Comment.find(commentQuery)
    .sort({
        "createdAt": sort
    })
    .limit(limit)
    .skip(start_at)
    .catch(err => {
        return new UserInputError(err)
    })
    .then(result => {
            let interests = result.map(async(subComment) => {
            let subQuery = {}
            subQuery['level'] = 1
            subQuery["parent_comment_id"] = subComment.id
            let author = await User.findOne({ _id: subComment['commmenter_user_id'] })
            subComment['author'] = author
            let subComments = await Comment.find(subQuery)
                .sort({
                    "createdAt": 1
                })
                .then((subComments) => {              
                    return subComments
                })
                if(subComments.length>0){
                    await Promise.all(subComments.map(async (replyComment) => {
                        try {
                            let sub_author = await User.findOne({ _id: replyComment['commmenter_user_id'] })
                            replyComment['author'] = sub_author;
        
                            subComment.replyComments.push(replyComment)
                        } catch (error) {
                        console.log('error'+ error);
                        }
                    }))
                }

            return subComment
        });
        return interests;
    });
    
    return result;
};

module.exports.postComment = async (parent, params, {user}) => {
    const { 
        post_id, 
        news_id, 
        comment, 
        content_type, 
        data,
        level,
        parent_comment_id,
        comment_type

    } = params;
    let author = await User.findOne({ _id: user.sub })

    const commmenter_user_id = user.sub
    let commentItem = new Comment({
        post_id, 
        news_id, 
        commmenter_user_id, 
        comment, 
        content_type, 
        data,
        level,
        parent_comment_id,
        comment_type
    })


    let commentData = await commentItem.save()
         .then(async (subscriber) => {
            subscriber.subscriptions.push({
                type: 'comment',
                id: subscriber._id,
                payload: {
                    comment_id:subscriber._id
                }
            });
            const saveSubscribe = await subscriber.save()
            return saveSubscribe
         })
         .catch(() => {
            return { success: true }
            // return new UserInputError('Already subscribed to '+room['title']);
        })
 

    commentData['author']  = author
    if(comment_type == 0){
        let post = await PostModel.findOne({ _id: post_id});
        let alertAuthor = await User.findOne({ _id: post['author'] })
        
        let user_name = author['is_alias'] ? author['alias'] : `${author['first_name']} ${author['last_name']}`
        let post_title = post['title'] ? ` "${post['title']}".` : '.'
        var title = `${user_name} commented on your post${post_title}`
 

        if(level == 1){
            //alertAuthor = await User.findOne({ _id: commmenter_user_id })
            title = `${user_name} replied to your comment.`

            if (parent_comment_id) {
                let parent_comment = await Comment.findOne({ _id: parent_comment_id })
                if (parent_comment) {
                    alertAuthor = await User.findOne({ _id: parent_comment.commmenter_user_id })
                }
            }
        }

        let users = []
        users.push(author.id)
        let sent = await sendOneAlert(alertAuthor.id, {
            title,
            message: `${user_name}: "${comment}"`,
            type: "comment",
            link: `post:${post.id};comment:${commentData['_id']}`,
            users
        })
    }
  
    return commentData;

};

module.exports.commentLike = async (parent, params, {user}) => {
    const { 
        comment_id,         
        status

    } = params;

    let author = await User.findOne({ _id: user.sub })
    
    let comment = await Comment.findOne({ _id: comment_id})
    if(comment){
        let likes = comment['likes'];
        let selfLike = false
        let doubleLikes = [];
        for(const like of likes) {
            if(like == user.sub){
                selfLike = true
            }else{
                doubleLikes.push(like);
            }
        }
        if(status) {doubleLikes.push(user.sub)}

        const newData = {}
        newData['likes'] = doubleLikes
        let like =  Comment.findOneAndUpdate({
            _id: comment_id
        },
        newData,
        {
            upsert: false,
            useFindAndModify: false
        },
        async ( err, doc ) => {
            if (err) {
                return new UserInputError("Error updating like data")
            } else {
                return  doc._doc.likes;
            }

           
        })
        comment['likes'] = doubleLikes;
        let users = []
        users.push(author.id)
        let user_name = (author['is_alias']) ? author['alias'] : `${author['first_name']} ${author['last_name']}`
        let sent = await sendOneAlert(comment.commmenter_user_id, {
            title: `New Like`,
            message: `${user_name} liked your comment.`,
            type: "like",
            link: `post:${comment['post_id']};comment:${comment.id}`,
            users
        })
        return comment

    }else{
        return new UserInputError("Comment is not exist")
    }
};

