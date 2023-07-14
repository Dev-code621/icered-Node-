const mongoose 			= require('mongoose');
const UserRef = require('../schemas/User.ref.schema.js');
const LineupRequest = require('../schemas/LineupRequest.schema')

let RoomSchema = mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false
    },
    moderators: {
        type: Array,
        required: false
    },
    author: {
        type: String,
        required: true
    },
    settings: {
        type: Array,
        default: []
    },
    blacklist: {
        type: Array,
        default: []
    },
    participants: {
        type: Array,
        default: []
    },
    interests: {
        type: Array,
        required: false
    },
    schedule:{
        type: Object,
        required: false
    },
    subscribers: [UserRef],
    broadcasters: {
        type: Array,
        default: []
    },
    disabled: {
        type: Boolean,
        default: false
    },
    template: {
        type: String
    },
    invitees: {
        type: Array,
        default: []
    },
    line_up: {
        type: Array,
        default: []
    },
    listening: {
        type: Array,
        default: []
    },
    line_up_requests: [LineupRequest]
}, {timestamps: true});

module.exports = mongoose.model('room', RoomSchema);