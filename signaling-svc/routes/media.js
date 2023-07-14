const apollo = require('apollo-server-express')
const UserInputError = apollo.UserInputError
const Media = require('../schemas/Media.schema')
const helpers = require('../helpers');
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const authenticateJWT = helpers.authenticateJWT;
const aws_request_key = "jKd8f9JkdjfOOOdkkd.00024jfkLlf242fjdnBfjkel429O.dkfj492ifjkdlskdfj"

const AWS = require('aws-sdk');
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ID,
    secretAccessKey: process.env.AWS_SECRET
})

const { v4: uuidv4 } = require('uuid');

const router = require('express').Router();

const multer = require('multer');
const multers3 = require('multer-s3');
//const upload = multer({ dest: 'uploads/'})
const storage = multer.memoryStorage({
    destination: (req, file, cb) => {
        cb(null, '')
    }
})

const upload = multer();

router.put('/upload/update', async (req, res) => {
    const {
        key,
        job,
        destination
    } = req.body

    let out;
    console.log("Job Received: ", job)
    console.log('destination', destination)
    console.log('key', key)

    // Does media exist?
    let media = await Media.findOne({ media_key: key })
    if (!media) {
        let searchByThen = `https://icered-videos.s3.us-east-2.amazonaws.com/${key}`
        let mediaAgain = await Media.findOne({ media_url: searchByThen})
        if (!mediaAgain) {
            let err = `media "${key}" || "${searchByThen}"" not found.`
            out = { success: false, err }
        } else {
            mediaAgain['processing_status'] = "PROCESSING"
            let saved = await mediaAgain.save()
            out = { success: true }
        }
    } else {
        media['processing_status'] = "PROCESSING"
        let saved = await media.save()
        out = { success: true }
    }

    console.log(out)
    return res.json(out)
})

router.post('/upload',upload.array('media',10), async (req, res) => {
    var files = req.files;

    let responseData = {
        success: false
    }
    var fileKeys = Object.keys(files);
    const authHeader = req.headers.authorization;
    var result = []

    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
            if (err) {
                console.log("Err",err);
                console.error(err);
                responseData.status = 403
                responseData.message = err
                return res.status(403).json(responseData);
            }
            req.user = user;
            user['data'] = await User.findOne({ _id: user.sub })
            if (user['data']) {
                var count = 0;
                await Promise.all(fileKeys.map(async (key) => {
                    var file = req.files[key];
                  
                    if(file) {
                        let myImage = file.originalname.split('.')
                        const fileExt = myImage[myImage.length - 1].toLowerCase()

                        const fileName = uuidv4() + "." + fileExt
                        var fileSizeInBytes = file.size;
                        let image = false;
                        let type = false;
                        let proper_bucket;
                        console.log(fileExt)
                        switch(fileExt) {
                            case "gif":
                            case "png":
                            case "jpg":
                            case "jpeg":
                            case "heic":
                            case "heif":
                                image = true;
                                type = "image"
                                proper_bucket = process.env.AWS_BUCKET_NAME
                            break;
                            case "mp4":
                            case "mov":
                            case "hevc":
                                type = "video"
                                proper_bucket = process.env.AWS_VIDEO_BUCKET
                            break;
                            default:
                                // type = null
                        }

                        console.log("type", type)
                        console.log("bucket", proper_bucket, process.env.AWS_VIDEO_BUCKET)

                        if (!type) {
                            // Invalid file type
                            return res.status(401).json({
                                status: 401,
                                message: "Invalid file type. Only photos and videos can be uploaded"
                            })
                        }

                        if(type == "image" && fileSizeInBytes>5242880){
                            responseData.status = 401
                            responseData.message = 'You can upload max 5MB Images'
                            return res.status(401).json(responseData);
                        }

                        if(fileSizeInBytes > 4294967296 && type == "video"){
                            responseData.status = 401
                            responseData.message = 'You can upload max 4G videos'
                            return res.status(401).json(responseData);
                        }

                        let allowed = true
                        if(allowed) {
                            const params = {
                                Bucket: proper_bucket,
                                Key: fileName,
                                Body: file.buffer
                            }
                            s3.upload(params, async (err, data) => {
                                if (err) {
                                    responseData.status = 400
                                    responseData.message = err
                                    console.log(params)
                                    //console.log(err)
                                    return res.status(400)
                                        .send(responseData)
                                } else {
                                    var Media_date = {
                                        asset_owner: user.sub,
                                        media_size: fileSizeInBytes,
                                        media_type: fileExt,
                                        asset_type: type,
                                        bucket_name: proper_bucket,
                                        media_url: `https://${proper_bucket}.s3.us-east-2.amazonaws.com/${fileName}`,
                                        media_key: fileName
                                    };

                                    var media_create = new Media(Media_date)        
                                    let mediaDate = await media_create.save()

                                    count++
                                    result.push(data.Location)
                                    if(count === fileKeys.length){
                                        responseData.success = true
                                        responseData.status = 200
                                        responseData.location = result
                                        responseData.message = "Upload Successful"                                      
                                        return res.json(responseData)
                                    }
                                }
                            })
                        } else {
                            console.log('File type not allowed');
                            return res.sendStatus(400);
                        }
                    } else {
                        console.log('File Error');
                        responseData.status = 400
                        responseData.message = '"media" not received'
                        
                        return res.status(400).json(responseData);
                    }
                }));

            } else {
                console.log('User not found');
                responseData.status = 401
                responseData.message = 'Unauthenticated user'
                return res.status(401).json(responseData);
            }
        })
    } else {
        console.log('No Authorization Header Provided.');
        responseData.status = 401
        responseData.message = 'No Authorizeation Header Provided'
        return res.status(401).json(responseData);
    }
    
});

module.exports = router;