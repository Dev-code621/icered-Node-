const mongoose 			= require('mongoose');

const LevelSchema = require('../schemas/UserLevel.schema');

const UserlevelSchema = mongoose.Schema({
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

}, { timestamps: true });

module.exports = mongoose.model('userlevel', LevelSchema);
