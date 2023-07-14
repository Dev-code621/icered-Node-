const mongoose 			= require('mongoose');
const validate          = require('mongoose-validator');

const interest = require('../schemas/Interest.ref.schema');
const userRef = require('../schemas/User.ref.schema.js');
const userLevel = require('../schemas/UserLevel.schema');
const subscription = require('../schemas/Subscription.schema');
const alert = require('../schemas/Alert.schema');
const contact = require('../schemas/Contact.schema');
const device = require('../schemas/Devices.schema');
const Token = require('../schemas/Token.schema');
const Log = require('../schemas/Log.schema');
const PasscodeAction = require('../schemas/PasscodeAction.schema');
const convoAlert = require('../schemas/ConversationAlert.schema');
const UserIP = require('../schemas/UserIP.schema');
const warning = require('../schemas/Warning.schema')

let UserSchema = mongoose.Schema({
    first_name:      {
        type: String,
        trim: true,
        index: true,
    },
    last_name:      {
        type: String,
        trim: true,
        index: true,
    },
    alias:      {
        type: String,
        trim: true,
        index: true,
        unique: true
    },
    location:      {
        type: String,
        trim: true,
        index: true,
        default: ""
    },
    email: {
        type: String,
        required: false,
        validate: {
            validator: (value) => {
            if (value === "" || !value) return true;
                return /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(String(value).toLowerCase());
            },
            message: "Not a valid email-address."
        }
    },
    phone_country_code:	{
        type: String, 
        lowercase:true, 
        trim: true, 
        index: true,
        required: true,
        sparse: true,//sparse is because now we have two possible unique keys that are optional
        validate:[
            validate({
                validator: 'isNumeric',
                arguments: [7, 20],
                message: 'Not a valid phone number.',
            })
        ]
    },
    phone:	    {
        type: String, 
        trim: true,
        required: false,
        sparse: true,//sparse is because now we have two possible unique keys that are optional
        validate:[
            validate({
                validator: 'isNumeric',
                arguments: [7, 20],
                message: 'Not a valid phone number.',
            })
        ]
    },
    phone_verified: {
        type: Boolean,
        default: false,
        index: true
    },
    profile_complete: {
        type: Boolean,
        default: false,
        index: true
    },
    profile_photo_url: {
        type: String,
        default: ""
    },
    full_phone_number: {
        type: String,
        trim: true
    },
    
    interests: [interest],
    followers: [ userRef ],
    subscriptions: [ subscription ],
    date: {
        type: Date,
        default: Date.now()
    },
    anonymous: {
        type: Boolean,
        default: false
    },
    alerts: [ alert ],
    devices: [ device ],
    last_active: {
        type: Date,
        default: Date.now()
    },
    refreshTokens: [Token],
    webTokens: [Token],
    is_bot: {
        type: Boolean,
        default: false
    },
    is_alias: {
        type: Boolean,
        default: false
    },
    is_admin: {
        type: Boolean,
        default: false
    },
    is_developer: {
        type: Boolean,
        default: false
    },
    bot_admin: {
        type: String
    },
    alias_owner: {
        type: String
    },
    bio: {
        type: String
    },
    tokens: {
        type: Number,
        default: 0.00
    },
    logs: [Log],
    
    last_login_ip: UserIP,
    login_ip_history: [String],

    blockUsers:{
        type:[String]
    },
    status:{
        type: Boolean,
        default: true 
    },
    passcode_actions: [PasscodeAction],
    referrals_available: {
        type: Number,
        default: 1
    },
    contacts: [contact],
    contact_invites: [contact],
    contact_requests: [contact],
    conversation_alerts: [convoAlert],
    is_banned: {
        type: Boolean,
        default: false
    },
    warnings: [warning],
    userBlocked:{
        type:Boolean,
        default:false,
    },

    userLevel:{
        type: Number,
        default: 3
    },
    ownerUserId:{
        type: String,
        default: ""
    },
}, {timestamps: true});

module.exports = mongoose.model('user', UserSchema);
