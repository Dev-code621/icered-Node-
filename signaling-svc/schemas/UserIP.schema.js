const mongoose = require('mongoose')

let UserIPschema = mongoose.Schema({
    userId: String,
    ip: String,
    country: String,
    region: String,
    eu: String,
    timezone: String,
    city: String,
    longitude: Number,
    latitude: Number,
    metro: Number,
    area: Number
})

module.exports = UserIPschema