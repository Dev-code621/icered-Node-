const helpers = require('../helpers');
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const authenticateJWT = helpers.authenticateJWT;

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
const filterImage = function (req, file, cb) {
    console.log('req', req)
    let allowed = false;
    switch(file.mimetype) {
        case "image/png":
        case "image/gif":
        case "image/jpeg":
        case "image/jpg":
        case "image/heif":
        case "image/heic":
            allowed = true;
        break;
    }
    if(!allowed)
        return cb(new Error('Only image files are allowed!'), false);
    cb(null, true);
};
const upload = multer({
   
    filter: filterImage
});


/* const upload = multer({
    storage: multers3({
        s3: s3,
        bucket: process.env.AWS_BUCKET_NAME,
        metadata: function (req, file, cb) {
            cb(null, {fieldName: file.fieldname});
        },
        key: function (req, file, cb) {
            cb(null, Date.now().toString())
        }
    }),
    filter: filterImage
}) */

router.post('/interests', authenticateJWT, async (req, res) => {
    // Subscribe a user to an interest
    const {
        interestId,
        method
    } = req.body;

    if (req.user.sub && interestId) {
        // Find the user
        let user = await User.findOne({ _id: req.user.sub })
        res.json(user);

        switch(method) {
            case 'subscribe':

            break;
            case 'unsubscribe':

            break;
        }


    } else {
        res.json({ error: { message: 'missing userId or interestId' }})
    }
});

router.post('/avatar', upload.single('image'), async (req, res) => {
    const authHeader = req.headers.authorization;
    let responseData = {
        success: false
    }

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
            // Lets get the user
            user['data'] = await User.findOne({ _id: user.sub })

            if (user['data']) {
                const file = req.file;
                if(file) {
                    let myImage = file.originalname.split('.')
                    const fileExt = myImage[myImage.length - 1]
                    const fileName = myImage[0]
                    //console.log('file', user, file, myImage, req.user.sub);
                    let allowed = false;
                    switch(fileExt) {
                        case "gif":
                        case "png":
                        case "jpg":
                        case "jpeg":
                        case "heic":
                        case "heif":
                            allowed = true;
                        break;
                    }
                    if(allowed) {
                        const params = {
                            Bucket: process.env.AWS_BUCKET_NAME,
                            Key: `${uuidv4()}.${fileExt}`,
                            Body: file.buffer
                        }
                        // Send to AWS
                        console.log('params', params)
                        s3.upload(params, async (err, data) => {
                            if (err) {
                                res.status(500)
                                    .send(err)
                            } else {
                                responseData.success = true
                                responseData.status = 200
                                responseData.location = data.Location

                                updateObj = { 
                                    profile_photo_url: data.Location
                                }

                                const updated = await User.updateOne({ _id: req.user.sub }, updateObj)
                                    .then( datas => {
                                        console.log('datas', datas)
                                        responseData.message = "Avatar replaced successfully"
                                        return res.status(200).json(responseData)
                                    })
                                    .catch(err => {
                                        responseData.message = err
                                        responseData.success = false
                                        return res.json(responseData)
                                    })
                            }
                        })
                    } else {
                        console.log('File type not allowed');
                        responseData.status = 400
                        responseData.message = 'File type not allowed'
                        res.status(400).json(responseData);
                    }
                } else {
                    console.log('File Error');
                    responseData.status = 400
                    responseData.message = '"image" not received'
                    res.status(400).json(responseData);
                }
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
  
})
router.post('/upload', upload.single('image'), async (req, res) => {
    console.log('keys', Object.keys(req))
    let responseData = {
        success: false
    }

    const authHeader = req.headers.authorization;
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
                const file = req.file;
                if(file) {
                    let myImage = file.originalname.split('.')
                    const fileExt = myImage[myImage.length - 1]
                    const fileName = myImage[0]
                    let allowed = false;
                    switch(fileExt) {
                        case "gif":
                        case "png":
                        case "jpg":
                        case "jpeg":
                        case "heic":
                        case "heif":
                            allowed = true;
                        break;
                    }
                    if(allowed) {
                        const params = {
                            Bucket: process.env.AWS_BUCKET_NAME,
                            Key: `${uuidv4()}.${fileExt}`,
                            Body: file.buffer
                        }
                        s3.upload(params, async (err, data) => {
                            if (err) {
                                responseData.status = 400
                                responseData.message = err
                                
                                return res.status(400)
                                    .send(responseData)
                            } else {
                                responseData.success = true
                                responseData.status = 200
                                responseData.location = data.Location
                                responseData.message = "Upload Successful"
                                return res.json(responseData)
                            }
                        })
                    } else {
                        console.log('File type not allowed');
                        return res.sendStatus(400);
                    }
                } else {
                    console.log('File Error');
                    responseData.status = 400
                    responseData.message = '"image" not received'
                    
                    return res.status(400).json(responseData);
                }
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
})

router.put('/profile', authenticateJWT, async (req, res) => {
    const {
        first_name,
        last_name,
        alias,
        location,
        phone_country_code,
        phone,
        profile_photo_url
    } = req.body;

    console.log('user', req.user.sub);
    const _id = req.user.sub;

    let updateObj = {};

    if (first_name) updateObj['first_name'] = first_name;
    if (last_name) updateObj['last_name'] = last_name;
    if (alias) updateObj['alias'] = alias;
    if (location) updateObj['location'] = location;
    if (profile_photo_url) updateObj['profile_photo_url'] = profile_photo_url;
    
    if (phone || phone_country_code) {
        let user = await User.findOne({ _id: req.user.sub })
        
        if (phone_country_code) {
            if (!phone) phone = user.phone;
            updateObj['phone_country_code'] = phone_country_code;
        }

        if (phone) {
            if (!phone_country_code) phone_country_code = user.phone_country_code;
            updateObj['phone'] = phone;
        }

        updateObj['full_phone_number'] = `${phone_country_code}${phone}`;
    }
    const updated = await User.updateOne({ _id: req.user.sub }, updateObj);
    
    console.log('updateOne User', updated);
    
    res.json({ nModified: updated.nModified, _id, updateObj })
})

router.post('/fcmToken', authenticateJWT, async (req, res) => {
    const {
        name,
        token,
        deviceUDID,
        platform
    } = req.body;


    let result = await User.find({})
    .catch(err => {
        return new UserInputError(err)
    })
    .then(result => {
        let interests = result.map(async(oneUser)=> {
            var flag = false;
            oneUser.devices.map(async(device) => {
                if(device.deviceUDID === deviceUDID && device.platform === platform){
                    flag = true;
                    oneUser.devices.remove(device['_id'])
                    console.log("aaaaa",device);
                    await oneUser.save()
                }
            })
        });
        return interests;
         
    });


    if (req.userData) {
        let user = await User.findOne({ _id: req.user.sub })
        user.devices.push({
            name,
            token,
            deviceUDID,
            platform
        })

        await user.save().then((data) => {
            res.json({
                success: true,
                data
            })
        }).catch((err) => {
            res.status(400).json(err)
        })
    } else {
        res.status(401).json({
            error: {
                message: 'Not Authorized'
            }
        })
    }
});

module.exports = router;