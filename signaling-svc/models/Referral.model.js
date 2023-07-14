const mongoose = require('mongoose')
const validate = require('mongoose-validator')

let ReferralSchema = mongoose.Schema({
    phone_country_code: {
        type: String,
        required: true,
        index: true,
        trim: true,
        validate: [
            validate({
                validator: 'isNumeric',
                arguments: [7, 20],
                message: 'Not a valid phone country code.'
            })
        ]
    },
    phone: {
        type: String,
        required: true,
        index: true,
        trim: true,
        sparse: true,
        validate: [
            validate({
                validator: 'isNumeric',
                arguments: [7, 20],
                message: 'Not a valid phone number.'
            })
        ]
    },
    full_phone_number: {
        type: String,
        trim: true,
        unique: true,
        required: true
    },
    author: {
        type: String,
        index: true,
        trim: true,
        required: true
    },
    first_name: {
        type: String,
        required: false,
        trim: true
    },
    last_name: {
        type: String,
        required: false,
        trim: true
    },
    registered: {
        type: Boolean,
        default: false
    },
    userLevel: {
        type: Number,
        default:3
    },
}, { timestamps: true })

module.exports = mongoose.model('referral', ReferralSchema)