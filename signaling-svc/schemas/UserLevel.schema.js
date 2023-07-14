const mongoose  = require('mongoose');

module.exports = mongoose.Schema({
    user_id: {
        type: String,
        required: true,
        index: true,
        trim: true
    },
    
    userLevel:{
        type: Number,       
    },
    inviteCount:{
        type: Number,
    }
}, {timestamps: true});
