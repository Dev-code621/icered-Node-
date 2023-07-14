const mongoose 			= require('mongoose');

const Media = mongoose.Schema({
    asset_owner: {
        type: String,
        required: true
    },
    media_url: {
        type: String,
        required: true
    },
    media_size: {
        type: Number
    },
    media_type: {
        type:String
    },
    postID: {
        type:String
    },
    asset_type: {
        type: String,
        default: "image"
    },
    bucket_name: {
        type: String
    },
    processing_status: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Media', Media);
