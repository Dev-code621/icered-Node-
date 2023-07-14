const mongoose 			= require('mongoose');
const Conversation = require('../schemas/Conversation.schema');

module.exports = mongoose.model('conversation', Conversation);
