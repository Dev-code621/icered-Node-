const mongoose = require('mongoose');

module.exports = mongoose.Schema({
    name: String,
    passcode: String,
    data: String,
    expiration: Date
})

