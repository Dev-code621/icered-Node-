const mongoose 			= require('mongoose');

const country = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    country_code: {
        type: Number,
        required: true
    },
    symbol: {
        type: String,
        required: true,
        unique: true
    },
    lang: {
        type:String,
        required: false,
        default: 'en'
    }
    
}, { timestamps: true });

module.exports = mongoose.model('country', country);
