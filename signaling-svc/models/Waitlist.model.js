const mongoose = require('mongoose')
const validate = require('mongoose-validator')

let WaitlistSchema = mongoose.Schema({
    phone_country_code: {
        type: String,
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
        unique: true
    },
    email: {
        type: String,
        trim: true,
        unique: true
    },
    approved: {
        type: Boolean,
        default: false
    },
    registered: {
        type: Boolean,
        default: false
    }
}, { timestamps: true })

module.exports = mongoose.model('waitlist', WaitlistSchema)