const mongoose 			= require('mongoose');
const Token = require('../schemas/Token.schema');

let GuestSchema = mongoose.Schema({
    deviceID:{
        type: String,
        default: ""
    },
    refreshTokens: [Token],
    webTokens: [Token],
}, {timestamps: true});

module.exports = mongoose.model('guest', GuestSchema);
