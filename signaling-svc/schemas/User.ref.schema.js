const mongoose 			= require('mongoose');

module.exports = mongoose.Schema({
    user_id: {
        type: String,
        required: true,
        index: true,
        trim: true
    },
    alias: {
        type: String
    },
    first_name: {
        type: String
    },
    last_name: {
        type: String
    },
    phone_country_code: {
        type: String
    },
    phone: {
        type: String
    },
    full_phone_number: {
        type: String
    },
    profile_photo_url: {
        type: String
    },
    anonymous: {
        type: Boolean
    },
    last_active: {
        type: Date,
        default: Date.now()
    },
    tokens: {
        type: Number,
        default: 0.00
    },    
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
    }
}, {timestamps: true});
