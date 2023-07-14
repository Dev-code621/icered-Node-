const mongoose 			= require('mongoose');
const message = require('../schemas/Message.schema');

const user = mongoose.Schema({
    user_id: {
        type: String,
        required: true
    },
    alias: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('chat', mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    users: [ user ],
    messsages: [ message ],
    latest_message: { 
        type: Map,
        default: {
            from: {
                uid: 'system',
            },
            message: 'Begin chatting 🚀',
            date: Date.now()
        }
    },
    date: {
        type: Date,
        default: Date.now()
    }
}, {timestamps: true}));
