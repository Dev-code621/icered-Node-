const helpers = require('../helpers')
const apollo = require('apollo-server-express')

const { 
    sendAlerts
} = require('../helpers/alerts.helper')

const Post = require('../models/Post.model')

const User = require('../models/User.model')
const Room = require('../models/Room.model')
const Report = require('../models/Reports.model')

const UserInputError = apollo.UserInputError

const createReport = helpers.createReport

module.exports.list = async (parent, params, { user, indices }) => {
    let reader = await User.findOne({ _id: user.sub })

    if (!reader) {
        return new UserInputError("Must be logged in to view reports")
    }

    if (!reader['is_admin']) {
        return new UserInputError("Must be an administrator to view reports")
    }

    let {
        content_type,
        content_author,
        author,
        content_data,
        code
    } = params

    content_type = (!content_type ? 'all' : content_type)
    let search = {}
    
    // Search by code
    if (code) {
        search['code'] = code
    }

    if (content_author) {
        search['content_author'] = content_author
    }

    if (author) {
        search['author'] = author
    }

    if (content_data) {
        search['content_data'] = content_data
    }
    // Search by content type
    switch(content_type) {
        case 'post':
            search['content_type'] = 'post'
        break;
        case 'postComment':
            search['content_type'] = 'postComment'
        break;
        case 'room':
            search['content_type'] = 'room'
        break;
        case 'roomComment':
            search['content_type'] = 'roomComment'
        break;
        case 'user':
            search['content_type'] = 'user'
        break;
        case 'message':
            search['content_type'] = 'message'
        break;
        default:

    }

    let reports = await Report.find(search)
    return reports
}

module.exports.resolveReport = async (parent, { userID, code, description }, { user, indices }) => {

}

module.exports.createReport = async (parent, { userID, code, description }, { user, indices }) => {

}

module.exports.reportUser = async (parent, { userID, code, description }, { user, indices }) => {

}

module.exports.reportRoom = async (parent, { roomID, code, description }, { user, indices }) => {

}

module.exports.reportRoomComment = async (parent, { roomID, commentID, code, description }, { user, indices }) => {

}

module.exports.reportPost = async (parent, { postID, code, description }, { user, indices, req }) => {
    let post = await Post.findOne({ _id: postID })
    if (!post) {
        return new UserInputError("Post does not exist")
    }

    // who is reporting this?
    let reporter = await User.findOne({ _id: user.sub })
    if (!reporter) {
        return new UserInputError("Must be logged in to submit a report")
    }

    console.log('the ip address', req.socket.remoteAddress)
    console.log('request headers', req.headers)

    const ip_address = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'] : remote.socket.remoteAddress

    // Lets create the report
    let details = {
        code,
        description,
        content_type: 'post',
        content_author: post['author'],
        content_data: postID,
        author: user.sub,
        logs: [],
        ip_address
    }

    details.logs.push({
        type: "report",
        message: `Report created.`
    })

    let result = await createReport(details).then(res => {
        console.log('report created', res)
        return { success: true }
    }).catch(err => {
        throw new UserInputError(err)
    })

    return result
}

module.exports.reportPostComment = async (parent, { roomID, code, description }, { user, indices }) => {

}