
const mongoose 			= require('mongoose');
const Button = mongoose.Schema({
    label: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: false
    },
    link: {
        type: String,
        required: true
    },
    link_type: {
        type: String,
        required: false
    },
    icon: {
        type: String,
        required: false
    }
})

module.exports = mongoose.Schema({
    message: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    subtext: {
        type: String,
        required: false,
        trim: true
    },
    link: {
        type: String,
        required: false,
        trim: true
    },
    link_type: {
        type: String,
        required: false,
        trim: true
    },
    icon: {
        type: String,
        required: false,
        trim: true
    },
    read: {
        type: Boolean,
        default: false
    },
    buttons: [Button],
    users: [String]
}, {timestamps: true});