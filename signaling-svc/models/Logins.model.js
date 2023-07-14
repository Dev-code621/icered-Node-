const mongoose = require('mongoose')
const Log = require('../schemas/Log.schema')
// Track logins by IP address
module.exports = mongoose.model('ip_login', mongoose.Schema({
   ip: String,
   logs: [Log],
   longitude: Number,
   latitude: Number,
   users: [String],
   devices: [String]
}))