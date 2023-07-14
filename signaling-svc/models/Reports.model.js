const mongoose 			= require('mongoose');
const UserRef = require('../schemas/User.ref.schema.js');
const Log = require('../schemas/Log.schema')

let ReportSchema = mongoose.Schema({
    code: {
        type: Number,
        required: true
    },
    description: {
        type: String
    },
    author: {
        type: String,
        required: true
    },
    content_type: {
        type: String
    },
    content_author: {
        type: String
    },
    content_data: {
        type: String
    },
    resolved: {
        type: Boolean,
        default: false
    },
    logs: [Log],
    ip_address: {
        type: String,
        required: true
    }
}, {timestamps: true});

module.exports = mongoose.model('report', ReportSchema);