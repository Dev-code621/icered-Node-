const mongoose = require('mongoose');
module.exports = mongoose.Schema({
  post_id: {
    type: String,
    required: true
  }
}, { _id: false })