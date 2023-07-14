const mongoose 			= require('mongoose');
const Post = require('../schemas/Post.schema');

module.exports = mongoose.model('post', Post);
