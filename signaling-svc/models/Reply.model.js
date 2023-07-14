const mongoose 			= require('mongoose');
const Reply = require('../schemas/Reply.schema');

module.exports = mongoose.model('reply', Reply);
