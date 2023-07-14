const mongoose 			= require('mongoose');

const Message = mongoose.Schema({
    from: String,
    content: String,
    type: String
})
module.exports = mongoose.Schema({
   unread: [Message]
}, {timestamps: true});
