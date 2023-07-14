const twilio = require('twilio')
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
const sgMail = require('@sendgrid/mail')
const jwt = require('jsonwebtoken')
const randtoken = require('rand-token')
const helpers = require('../helpers')
const apollo = require('apollo-server-express')

const Subscription = require('../schemas/Subscription.schema')
const InterestRef = require('../schemas/Interest.ref.schema')
const Alert = require('../schemas/Alert.schema')

const { 
    sendOneAlert
} = require('../helpers/alerts.helper')

const { 
    generateSixDigitCode, 
    createPasscodeAction,
    doCodeAction
} = require("../helpers")

const PostM = require('../models/Post.model')
const ReplyM = require('../models/Reply.model')
const User = require('../models/User.model')
const Room = require('../models/Room.model')
const Interest = require('../models/Interest.model')
const UserModel = require('../models/User.model')
const Referral = require('../models/Referral.model')
const UserLevel = require('../models/Userlevel.model')

const e = require('express')
const { count } = require('../models/User.model')

const checkIfUserHasInterest = helpers.checkIfUserHasInterest
const UserInputError = apollo.UserInputError

// Set sendgrid api key
sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  
module.exports.searchProfiles = async (parent, { 
    search, 
    start_at, 
    limit,
    sort,
    search_by
}, { user, indices }) => {
    const { usersProfile } = indices
    sort = ( sort == 'asc' ? 1 : -1)
    start_at = (!start_at ? 0 : start_at)
    limit = (!limit ? 0 : limit)
    
    let query = {}
    if(search_by == "phone"){
        query['phone'] = { "$regex": search, "$options": "i" }
    }else if(search_by == "email"){
        query['email'] = { "$regex": search, "$options": "i" }
    }else{
        
        let list = await User.find({$or:[{"first_name":{ "$regex": search, "$options": "i" }},{"last_name":{ "$regex": search, "$options": "i" }}
        ,{"alias":{ "$regex": search, "$options": "i" }}]})
        .sort({
            "createdAt": sort
        })
        .limit(limit)
        .then((result) => {              
            return result
        })
        return list
    }

    let list = await User.find(query)
        .sort({
            "createdAt": sort
        })
        .limit(limit)
        .then((result) => {              
            return result
        })
        return list
} 
module.exports.author = {
    id: parent => {
        return parent;
    },
    name: async (parent) => {
        let author = await User.findOne({_id: parent})
        let returnName = '';
      
        if (author) {
            if (!author['is_alias']) {
                returnName = author['first_name']

                if (author['last_name'] && author['last_name'] !== '') {
                    returnName = `${author['first_name']} ${author['last_name']}`
                }
            } else {
                return author['alias']
            }
        } else {
            returnName = "Deleted User"
        }
        return returnName;
    },
    username: async (parent) => {
        let author = await User.findOne({_id: parent})
        if (!author) {
            return author['alias']
        } else {
            return 'Deleted User'
        }
    },
    account_type: async (parent) => {
        let author = await User.findOne({ _id: parent })

        if (author) {
            if (author['is_alias']) {
                return 'alias';
            }
            
            if (author['is_bot']) {
                return 'bot';
            }

            return 'primary'
        } else {
            return 'deleted'
        }
    },
    name_type: async (parent) => {
        let author = await User.findOne({_id: parent})
        let returnName = 'alias'
    
        if (author && author['profile_complete'] && !author['anonymous']) {
            if (!author['anonymous']) {
                if (author['alias'] && author['alias'] !== '') {
                    returnName = 'alias'
                } else {
                    returnName = `full_name`
                }
            }
        }
        
        return returnName
    },
    profile_photo_url: async (parent) => {
        let author = await User.findOne({_id: parent})
        
        if (author) {
            return author.profile_photo_url
        } else {
            return null;
        }
    },
    is_bot: async (parent) => {
        let author = await User.findOne({_id: parent})

        if (author) {
            return author.is_bot
        } else {
            return null
        }
    }
}

module.exports.userSubscriptionQuery = {
    id: parent => {
        return parent._id;
    },
    type: parent => {
        console.log('type', parent)
        return parent.type;
    },
    payload: parent => {
        console.log('payload', parent.payload)
        return JSON.stringify(parent.payload)
    }
}

module.exports.userRef = {
    id: parent => {
        return parent._id;
    },
    display_name: async (parent) => {
        let user = await User.findOne({ _id: parent.user_id })
        let display_name = `${user.first_name} ${user.last_name}`
        if (user.anonymous) {
            display_name = `Anon`
        }
        return display_name;
    },
    user_id: parent => {
        return parent.user_id
    }
}

module.exports.list = async () => {
    let result = await User.find({}).sort({_id: -1}).limit(25);
    return result;
}

module.exports.active = async (parent, attr, auth ) => {
    let exists = await User.findOne({ _id: auth.user.sub })
    if (!exists) {
        return new UserInputError("User does not exist");
    } else {
        const last_active = Date.now()
        console.log('last_active', last_active)
        
        await User.findOneAndUpdate(
            { 
                _id: auth.user.sub 
            }, 
            { last_active }, 
            {
                upsert: false,
                useFindAndModify: false
            }, 
            async (err, doc) => {
                if (err) {
                    throw new UserInputError("Error updating user data");
                }
                console.log('user updated', doc)
                
            }
        )
        return { success: true };
    }
}

module.exports.update = async (parent, attr, {user, auth, indices }) => {
    let exists = await User.findOne({ _id: user.sub });
    let { usersProfile } = indices;
    
    if(!exists) {
        return new UserInputError("User does not exist");
    } 

    const newData = {}
    const allowed = [
        'first_name', 
        'last_name', 
        'alias',
        'location',
        'anonymous'
    ]
    const completed_requirements = [
        'first_name',
        'last_name',
        'location'
    ]

    console.log('the phone country code is', exists)
    let createAliasAccount = (alias) => {
        /* 
            WARNING: THIS FUNCTION ONLY TO BE USED BY FIRST LOGIN
             TO PREVENT THROWING ERRORS IF USER HAS REACHED ALIAS LIMIT
        */
        return new Promise(async (resolve, reject) => {
            // Now lets attempt to create an alias account using this
            if (exists['is_alias']) {
                return reject('Alias accounts cannot create other aliases')
            }

            // Find the current alias accounts
            let aliases = await User.find({ alias_owner: user.sub })

            if (aliases.length < 3) {
                let alias = attr['alias'],
                    first_name = attr['alias'],
                    last_name = "",
                    phone_country_code = exists['phone_country_code']
                

                // Check to see if alias already exists
                let aliasExists = await User.findOne({ alias })
                if (aliasExists) {
                    return reject("That alias name is already taken.", aliasExists['_id'])
                }

                let data = {
                    alias,
                    first_name,
                    last_name,
                    is_alias: true,
                    alias_owner: user.sub,
                    status: true,
                    phone_country_code
                }
                let Alias = new User(data)
                console.log('create alias data', Alias)
               
                await Alias.save()
                    .then(aliasData => {

                        return resolve(aliasData)
                    })
                    .catch(err => {
                        console.log("this is errror", err)
                        return reject(err)
                    })
            } else {
                return reject("Alias account limit reached.")
            }
        }
    )}

    if (attr['alias']) {
        let aliasCreated = await createAliasAccount(attr['alias'])
            .then(aRes => {
                console.log('alias created?', aRes)
                return true;
            })
            .catch(err => {
                //console.log('err', err)
                throw new UserInputError(err)
            })
        attr.alias = user.sub
        console.log('was it created though?', aliasCreated)
    }

    // lets count all params existing towards our progress
    let progress = 0;
    let __user = await User.find({ _id: user.sub })
    
    completed_requirements.forEach((requirement) => {
        if (__user[requirement]) {
            progress += 1
        } else {
            if (attr[requirement]) {
                progress += 1
            }
        }
    })

    if (progress >= completed_requirements.length) {
        newData['profile_complete'] = true
    }

    // Lets only store the allowed params
    allowed.forEach(function(val, key) {
        if(attr[val]) {
            newData[val] = attr[val];
        }
    })
    console.log(allowed, newData);
    
    return  User.findOneAndUpdate({ 
            _id: user.sub 
        }, 
        newData, 
        {
            upsert: false,
            useFindAndModify: false
        }, 
        async (err, doc) => {
            if (err) {
                throw new UserInputError("Error updating user data");
            } else {
                // console.log(doc);
                let save = {
                    createdAt: doc._doc.createdAt,
                    updatedAt: doc._doc.updatedAt,
                    last_active: doc._doc.last_active,
                    interests: doc._doc.interests,
                    alias: doc._doc.alias,
                    first_name: doc._doc.first_name,
                    last_name: doc._doc.last_name,
                    followers: doc._doc.followers,
                    location: doc._doc.location,
                    anonymous: doc._doc.anonymous,
                    profile_complete: doc._doc.profile_complete,
                    full_phone_number: doc._doc.full_phone_number,
                    email: doc._doc.email
                }
                
                let saveIndex = await usersProfile.saveObject({
                    objectID: user.sub,
                    ...save
                })
                // console.log('saveIndex', saveIndex)
            }
            // console.log('user updated', doc)
            return doc;
        }
    )
    
}

module.exports.login = async (parent, params, __) => {
    const { 
        phone_country_code,
        phone
    } = params;

    let searchBy = { phone: phone, phone_country_code: phone_country_code };
    let userExists = await User.findOne(searchBy)

    if (userExists) {
        // We have to make sure the user exists
        if (userExists['is_banned']) {
            throw new UserInputError('Your account has been restricted.')
        }

        const status = await client
            .verify
            .services('VAde7c48834afaa798178a7a5ce3379305')
            .verifications
            .create({
                to: `+${phone_country_code}${phone}`,
                channel: 'sms'
            })
            .then(data => {
                return { success: true };
            })
            .catch(err => {
                console.log(err);
                return { success: false, message: "Could not send to this phone number." }; 
            });
        return status;
    } else {
        let referral = await Referral.findOne({ 
            phone_country_code, 
            phone
        })

        // Create basic user account with phone number only
        let user = new User({
            phone_country_code,
            phone,
            full_phone_number: `${phone_country_code}${phone}`
        })

        const verifyPromise = async (response) => {
            return new Promise((resolve, reject) => {
                client
                    .verify
                    .services('VAde7c48834afaa798178a7a5ce3379305')
                    .verifications
                    .create({to: `+${phone_country_code}${phone}`, channel: 'sms'})
                    .then(data => {
                        console.log('verify data', data, response._id);
                        resolve({ success: true });
                    })
                    .catch(err => {
                        console.log(err);
                        let errRet = "Could not send to this phone number."
                        resolve({ 
                            success: false, 
                            message: errRet
                        })
                    });
                })
        }

        if(referral){
        
        const save = await user.save()
            .then(async (newUser) => {
                console.log('response', newUser)
                let verified = await verifyPromise(newUser);
                console.log('verified', verified)

                // This should be the first sign in
                    let referrerId = referral.author
                    let referrer = await User.findOne({ _id: referrerId })

                    referral.registered = true
                    let saveReferral = await referral.save()

                    // Make new user follow the referrer
                    newUser.subscriptions.push({
                        type: 'user',
                        payload: {
                            user_id: referrerId,
                            userLevel: referral['userLevel'],
                            ownerUserId:referral.author,

                        }
                    })

                    newUser.followers.push({
                        user_id: referrerId
                    })

                    // Make referrer follow new user
                    if(referrer){
                        referrer.subscriptions.push({
                            type: 'user',
                            payload: {
                                user_id: newUser['_id']
                            }
                        })
    
                        referrer.followers.push({
                            user_id: newUser['_id'] 
                        })
    
    
                        let savedNewUser = await newUser.save()
                            .catch(err => {
                                console.log('Could not make users follow each other; referrals', err)
                            })
    
                        let savedReferrer = await referrer.save()
                            .catch(err => {
                                console.log('Could not make referrer follow back invitee; referrals', err)
                            })
                            let alert_message = referral['first_name'] ? `Your contact ${referral['first_name']}` : `You and a contact you referred`
                        if (referral['first_name']) {
                            if (referral['last_name']) {
                                alert_message += ` ${referral['last_name']}`
                            }

                            alert_message += ` and you`
                        }

                        let users = []
                        users.push(newUser['_id'])
                        await sendOneAlert(referrer['_id'], {
                            title: "Your referral joined!",
                            message: `${alert_message} now follow each other.`,
                            type: "newFollower",
                            link: `user:${newUser['_id']}`,
                            users
                        })
                        
                    }
                    

                    return { success: true }   
                

                return verified;
            })
            .catch(err => {
                // console.log('it errored', err)
                if (err.name == 'MongoError') {
                    console.error(err);
                    let values = [];
                    Object.keys(err.keyValue).map(key => {
                        values.push(`${key}: ${err.keyValue[key]}`)
                    })
                    return { 
                        success: false, 
                        message: `Duplicate entry found: ${values.join(', ')}`
                    } 
                } else {
                   console.log('error creating user', err)
                    return { success: false, message: errMessage}
                }
            });
            console.log('save', save);
            return save;
        }else{
               return { success: false, message: "You can't login,Please contact with admin user!"}
        }
        // if (referral) {
        //     let user = new User({
        //         phone_country_code,
        //         phone,
        //         full_phone_number: `${phone_country_code}${phone}`
        //     })

        //     const newUser = await user.save()
        //     console.log("aaaaa," ,newUser)
        //     let referrerId = referral.author
        //     let referrer = await User.findOne({ _id: referrerId })

        //     referral.registered = true
        //     let saveReferral = await referral.save()

        //     // Make new user follow the referrer
        //     newUser.subscriptions.push({
        //         type: 'user',
        //         payload: {
        //             user_id: referrerId,
        //             userLevel: referral['userLevel'],
        //             ownerUserId:referral.author,

        //         }
        //     })

        //     newUser.followers.push({
        //         user_id: referrerId
        //     })

        //     // Make referrer follow new user
        //     referrer.subscriptions.push({
        //         type: 'user',
        //         payload: {
        //             user_id: newUser['_id']
        //         }
        //     })

        //     referrer.followers.push({
        //         user_id: newUser['_id'] 
        //     })


        //     let savedNewUser = await newUser.save()
        //         .catch(err => {
        //             console.log('Could not make users follow each other; referrals', err)
        //         })
        //     let verified = await verifyPromise(savedNewUser);
        //     let savedReferrer = await referrer.save()
        //         .catch(err => {
        //             console.log('Could not make referrer follow back invitee; referrals', err)
        //         })
            
        //     let alert_message = referral['first_name'] ? `Your contact ${referral['first_name']}` : `You and a contact you referred`
        //     if (referral['first_name']) {
        //         if (referral['last_name']) {
        //             alert_message += ` ${referral['last_name']}`
        //         }

        //         alert_message += ` and you`
        //     }

        //     let users = []
        //     users.push(savedNewUser['_id'])
        //     await sendOneAlert(referrer['_id'], {
        //         title: "Your referral joined!",
        //         message: `${alert_message} now follow each other.`,
        //         type: "newFollower",
        //         link: `user:${savedNewUser['_id']}`,
        //         users
        //     })

        //     return savedNewUser;
        // }else{
        //     return { success: false, message: "You can't login,Please contact with admin user!"}
        // }
    }
}

module.exports.updateBackupEmail = async (parent, { email }, { user, indices }) => {
    // Make sure we're logged in
    if (!user.sub) {
        return new UserInputError("Not logged in")
    }

    let userData = await User.findOne({ _id: user.sub })

    // Make sure we're only doing this for the primary account
    if (userData['is_alias']) {
        userData = await User.findOne({ _id: userData['alias_owner'] })
    }

    if(email !== "") {
        if(!/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(String(email).toLowerCase())) {
            throw new UserInputError("Please use a valid email-address.");
        }
    }
    
    let code = generateSixDigitCode();
    console.log(`six digit code ${code}`)

    // Create passcode action
    let passcodeAction = {
        name: "changeEmail",
        passcode: code,
        data: email,
        expiration: (Date.now() + (1000 * 60 * 5))
    }

    let actionStatus = await createPasscodeAction(passcodeAction, userData['_id'])
        .then(status => {
            console.log('actionStatus', status)
            return status
        })
        .catch(err => {
            throw new UserInputError(err)
        })
    
    // Now send the email
    const msg = {
        to: email, // Change to your recipient
        from: 'no-reply@icered.com', // Change to your verified sender
        subject: 'Test: Icered Login Code',
        templateId: "d-36789cc31ee34741bcae0aa35799cf4a",
        dynamicTemplateData: {
            code
        }
    }

    return sgMail
        .send(msg)
        .then(() => {
            console.log('Email sent')
            return { success: true }
        })
        .catch((error) => {
            console.error(error)
            throw new UserInputError(error)
        })
}

module.exports.verifyBackupEmail = async (parent, { email, code }, { user, indices }) => {
    // Lets make sure the user is logged in
    let userData = await User.findOne({ _id: user.sub })

    if (!userData) {
        return new UserInputError("Not logged in")
    }

    // Now lets get that code
    let passcodeActionStatus = await doCodeAction(code, user.sub, email)
        .then(async result => {
            console.log('result', result)
            return { success: true }
        })
        .catch(err => {
            throw new UserInputError(err)
        })
    
    return passcodeActionStatus
}

module.exports.sendEmailLoginCode = async (parent, { email }, __) => {
    // Make sure the email exists on the system
    let userData = await User.findOne({ email })
    if (!userData) {
        return new UserInputError("Email supplied has not been confirmed with us, so you won't be able to login using it.")
    }
    
    // Make sure we're only doing this for the primary account
    if (userData['is_alias']) {
        userData = await User.findOne({ _id: userData['alias_owner'] })
    }

    if(email !== "") {
        if(!/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(String(email).toLowerCase())) {
            throw new UserInputError("Please use a valid email-address.");
        }
    }
    
    let code = generateSixDigitCode();
    console.log(`six digit code ${code}`)

    // Create passcode action
    let passcodeAction = {
        name: "loginWithEmail",
        passcode: code,
        data: email,
        expiration: (Date.now() + (1000 * 60 * 5))
    }

    let actionStatus = await createPasscodeAction(passcodeAction, userData['_id'])
        .then(status => {
            console.log('actionStatus', status)
            return status
        })
        .catch(err => {
            throw new UserInputError(err)
        })
    
    // Now send the email
    const msg = {
        to: email, // Change to your recipient
        from: 'no-reply@icered.com', // Change to your verified sender
        subject: 'Test: Icered Login Code',
        templateId: "d-36789cc31ee34741bcae0aa35799cf4a",
        dynamicTemplateData: {
            code
        }
    }

    return sgMail
        .send(msg)
        .then(() => {
            console.log('Email sent')
            return { success: true }
        })
        .catch((error) => {
            console.error(error)
            throw new UserInputError(error)
        })
}

module.exports.verifyEmailLoginCode = async (parent, { email, code }, __) => {
    let userData = await User.findOne({ email })
    if (!userData) {
        return new UserInputError("No account associated with that Email address.")
    }

    let passcodeActionStatus = await doCodeAction(code, userData['_id'], email)
        .then(async result => {
            return true
        })
        .catch(err => {
            throw new UserInputError(err)
        })

    const { _id, permissions, roles }  = userData;
        
    let tokenResults = await generateTokens(
        _id, permissions, roles
    ).then((tokens) => {
        return tokens
    })
    .catch((err) => {
        return new UserInputError(err)
    })

    return tokenResults
}

module.exports.logout = async (parent, params, { req, user }) => {
    // Lets destroy the token and all associated tokens
    let account = await User.findOne({ _id: user.sub })
    if (!account) {
        return new UserInputError('Not authenticated')
    }

    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
        let currentToken = req.headers.authorization.split(' ')[1];

        // Loop through webTokens and remove this token
        account['webTokens'].forEach(async token => {
            console.log('checking token', token['_id'], token['token'])
            console.log('currentToken', currentToken)
            
            if (token['token'] == currentToken) {
                account.webTokens.remove(token['_id'])
                console.log('token removed', token['_id'])
                // Now lets loop through our aliases to remove those who have this as a linked token
                let aliases = await User.find({ alias_owner: user.sub })
                console.log('aliases', aliases)
                aliases.forEach(async (alias) => {
                    console.log('checking alias', alias['alias'])
                    if (alias['webTokens']) {
                        console.log('has webTokens', alias.webTokens)
                        alias['webTokens'].forEach(async aliasToken => {
                            if (aliasToken['linked_token'] == currentToken) {
                                alias.webTokens.remove(aliasToken['_id'])
                                console.log('removed alias token', aliasToken['linked_token'])
                                await alias.save()
                            }
                        })
                    }
                })
            }
        })

        await account.save()
        return {
            success: true
        }
    }
}

module.exports.register = async (parent, params, __) => {
    console.log('yo', params)
    const { 
        first_name, 
        last_name, 
        phone_country_code, 
        phone, 
        alias, 
        location
    } = params;
    
    let user = new User({
        first_name,
        last_name,
        alias,
        phone_country_code,
        phone,
        location,
        full_phone_number: `${phone_country_code}${phone}`
    })

    console.log('user', user)
    const verifyPromise = async (response) => {
        return new Promise((resolve, reject) => {
            client
                .verify
                .services('VAde7c48834afaa798178a7a5ce3379305')
                .verifications
                .create({to: `+${phone_country_code}${phone}`, channel: 'sms'})
                .then(data => {
                    console.log('verify data', data, response._id);
                    resolve(response._id);
                })
                .catch(err => {
                    console.log(err);
                    let errRet = new UserInputError(
                        "Could not send to this phone number." 
                    );
                    reject(errRet)
                });
            })
    }


    const save = await user.save()
        .then(async (response) => {
            console.log('response', response)
           let verified = await verifyPromise(response);
           console.log('verified', verified)
           return verified;
        })
        .catch(err => {
            // console.log('it errored', err)
            if (err.name == 'MongoError') {
                console.error(err);
                let values = [];
                Object.keys(err.keyValue).map(key => {
                    values.push(`${key}: ${err.keyValue[key]}`)
                })
                throw new UserInputError(`{
                    Duplicate entry found: ${values.join(', ')} 
                }`)
            } else {
                throw new UserInputError(err)
            }
        });
        console.log('save', save);
    return save;
}

const generateTokens = async (userID, permissions, roles, removeRefreshToken) => {
    return new Promise(async (resolve, reject) => {
        let user = await User.findOne({ _id: userID})

        if (user) {
            let refreshToken = {
                token: randtoken.uid(256),
                expires: (Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
            let refreshTokens = user['refreshTokens']
            let webTokens = user['webTokens']

            if (!refreshTokens) {
                refreshTokens = []
            } else {
                if (removeRefreshToken) {
                    let newRefreshTokens = []
                    refreshTokens.forEach((theToken) => {
                        if (theToken.token !== removeRefreshToken.token) {
                            newRefreshTokens.push(theToken)
                        }
                    })
                    refreshTokens = newRefreshTokens
                }
            }

            if (!webTokens) {
                webTokens = []
            } else {
                if (removeRefreshToken) {
                    let newWebTokens = []
                    webTokens.forEach((theToken) => {
                        if (theToken.token !== removeRefreshToken.linked_token) {
                            newWebTokens.push(theToken)
                        }
                    })
                    webTokens = newWebTokens
                }
            }

            let expiresIn = 24 * 60 * 60 * 1000
            let userToken = jwt.sign(
                { 
                    "permissions" : { 
                        roles, 
                        permissions 
                    } 
                },
                process.env.JWT_SECRET,
                { 
                    algorithm: "HS256", 
                    subject: `${userID}`,
                    expiresIn
                }
            );
            
            refreshToken['linked_token'] = userToken
            refreshTokens.push(refreshToken)
        
            webTokens.push({
                token: userToken,
                linked_token: refreshToken.token,
                expires: expiresIn
            })

            await User.updateOne({ _id: userID }, {
                phone_verified: true,
                refreshTokens: refreshTokens,
                webTokens: webTokens
            });

            resolve({ 
                jwt: userToken,
                jwt_expiration: expiresIn + Date.now(),
                refreshToken: refreshToken.token,
                refresh_expiration: refreshToken.expires
            });
        } else {
            reject('User does not exist.')
        }
    })
}

module.exports.verifyPhoneNumber = async (parent, { phone_country_code, phone, code }) => {
    const verifyNumber = () => {
        return new Promise((resolve, reject) => {
            client
                .verify
                .services('VAde7c48834afaa798178a7a5ce3379305')
                .verificationChecks
                .create({
                    to: `+${phone_country_code}${phone}`,
                    code: code
                })
                .then((response) => {
                    resolve(response);
                })
                .catch((err) => {
                    reject(err);
                })
        })
    };

    const verification = await verifyNumber()
        .then(async (verificationChecks) => {
            if (verificationChecks.valid === false) {
                throw new UserInputError("Invalid verification code.");
            }
            let result = await User.findOne({ full_phone_number: `${phone_country_code}${phone}` })
            // let levelData = await UserLevel.findOne({ userLevel: userData['userLevel'] });
            // const newData = {}
            // newData['referrals_available'] = levelData['inviteCount'];    
           
            // let result =  User.findOneAndUpdate({
            //     _id: userData._id
            // },
            // newData,
            // {
            //     upsert: false,
            //     useFindAndModify: false
            // },
            // async ( err, doc ) => {
            //     if (err) {
            //         return new UserInputError("Error updating user data")
            //     } else {
            //         return { success: true };
            //     }
        
               
            // })            
            const { _id, permissions, roles }  = result;
            
            let tokenResults = await generateTokens(
                _id, permissions, roles
            ).then((tokens) => {
                return tokens
            })
            .catch((err) => {
                return new UserInputError(err)
            })

            console.log("Token=",tokenResults)
            tokenResults['author'] = result
            return tokenResults
        });
    return verification;
}

module.exports.refreshJWT = async (parent, { userID, refreshToken }) => {
    let user = await User.findOne({ _id: userID })

    if (user) {
        // Lets loop through refresh tokens
        let token = false
        user['refreshTokens'].forEach(async (tokenData) => {
            if (tokenData.token === refreshToken) {
                token = tokenData
            }
        })

        if (token) {
            const { _id, permissions, roles }  = user;
            
            if (token['expires'] < Date.now()) {
                return new UserInputError('Refresh token expired')
            }
            
            let tokenResults = await generateTokens(
                _id, 
                permissions, 
                roles,
                token
            ).then((tokens) => {
                return tokens
            })
            .catch((err) => {
                return new UserInputError(err)
            })
            
            return tokenResults
        } else {
            return new UserInputError('Invalid refresh token')
        }
    } else {
        return new UserInputError('Invalid userID')
    }
}

module.exports.startLoginFlow = async (parent, { phone, phone_country_code }) => {
    let searchBy = { phone: phone, phone_country_code: phone_country_code };

    let user = await User.findOne({full_phone_number: `${phone_country_code}${phone}`})
    console.log('user', user);
    if (user) {
        // We have to make sure the user exists
        const status = await client
            .verify
            .services('VAde7c48834afaa798178a7a5ce3379305')
            .verifications
            .create({
                to: `+${phone_country_code}${phone}`,
                channel: 'sms'
            })
            .then(data => {
                return { status: data.status, url: data.url };
            })
            .catch(err => {
                console.log(err);
                throw new UserInputError("Could not send to this phone number."); 
            });
        return status;
    } else {
        throw new UserInputError("User does not exist");
    }
}

module.exports.me = async (parent, args, { user }) => {
    console.log('user', user);
    let userData = await User.findOne({ _id: user.sub });
    let levelData = await UserLevel.findOne({ userLevel: userData['userLevel'] });
    const newData = {}
    newData['referrals_available'] = levelData['inviteCount'];    
    let result =  User.findOneAndUpdate({
        _id: user.sub
    },
    newData,
    {
        upsert: false,
        useFindAndModify: false
    },
    async ( err, doc ) => {
        if (err) {
            return new UserInputError("Error updating user data")
        } else {
            return { success: true };
        }

       
    })
    return result;
}

module.exports.profile = async (parent, { id }, { user }) => {
    let result = await User.findOne({ _id: id })
    return result;
}

module.exports.subscribeToInterest = async (parent, { slug }, { user }) => {
    // Make sure user exists
    let loggedIn = await User.findOne({ _id: user.sub });
    
    if (loggedIn) {
        // console.log('loggedIn', loggedIn);
        // Lets make sure this slug exists on the database
        let interest = await Interest.findOne({ slug: slug })
        
        if (interest) {
            // Then lets add this interest to the user
            // console.log('interest', interest);
            const output = await User.findOne( { _id: user.sub })
                .then( async (subscriber) => {
                     console.log('subscriber', subscriber);
                    console.log('subscriber interests', subscriber.interests)
                    console.log('slug', slug)
                    const checkValid = await checkIfUserHasInterest(subscriber.interests, slug, false)
                        .then(async (d) => {
                            console.log('data', d)
                            console.log('user does not have interest');
                            subscriber.interests.push({
                                slug: slug
                            });
                            
                            const saveSubscribe = await subscriber.save()
                                .then(async (subscriber) => {
                                    console.log('interest saved');
                                    // Add this subscriber to the interest
                                    if(interest.subscribers  ==undefined) interest.subscribers =[];
                                    interest.subscribers.push( { user_id: subscriber._id });
                                    console.log(interest);
                                    // const saved = await interest.save()
                                    //     .then((nInterest) => {
                                    //         console.log('user added to interest', nInterest);
                                    //         return { success: true };
                                    //     })
                                    //     .catch((err) => {
                                    //         console.log('error', err);
                                    //         return new UserInputError('Could not add user to interest subscribers');
                                    //     });
                                    // return saved;
                                    return { success: true };
                                })
                                .catch((err) => {
                                    console.error(err);
                                    return new UserInputError('Could not ');
                                })
                            return saveSubscribe;
                        })
                        .catch((err) => {
                            console.log(err)
                            console.log('User already has interest')
                            return new UserInputError('Already subscribed to '+slug);
                        })
                    return checkValid;
                })
                .catch((err) => {
                    console.error('what', err);
                    throw new UserInputError('Something went wrong while fetching user data.');
                })
            return output;
        } else {
            throw new UserInputError("Interest does not exist."); 
        }
    } else {
        throw new UserInputError("You must be logged in."); 
    }
}

module.exports.unsubscribeFromInterest = async (parent, { slug }, { user }) => {
    // Make sure user exists
    let loggedIn = await User.findOne({ _id: user.sub });
    
    if (loggedIn) {
        // Lets make sure this slug exists on the database
        let interest = await Interest.findOne({ slug: slug })
        
        if (interest) {
            // Then lets remove this interest from the user
            console.log('interest', interest);
            const output = await User.findOne( { _id: user.sub })
                .then( async (subscriber) => {
                    console.log('subscriber', subscriber);
                    // Lets see if this user has the interest slug already
                  
                    
                    let checkIfUserSubbed = (subscribers) => {
                       return new Promise((resolve, reject) => {
                           console.log('testing', subscribers);
                           subscribers.map((subbed, i) => {
                               if (subbed.user_id === user.sub) {
                                   console.log('user subbed', subbed)
                                   resolve(subbed);
                               }

                               if (i === (subscribers.length - 1)) {
                                   reject();
                               }
                           })
                       })
                    };

                    const checkValid = await checkIfUserHasInterest(subscriber.interests, slug, true)
                        .then(async (subject) => {
                            console.log('user has interest');

                            subscriber.interests.remove(subject._id);

                            const saveSubscribe = await subscriber.save()
                                .then(async (subscriber) => {
                                    console.log('interest saved', interest.subscribers);
                                    // See if user is in subscribers
                                //     const subbedUser = await checkIfUserSubbed(interest.subscribers)
                                //        .then((subbed) => {
                                //            return subbed;
                                //        })
                                //        .catch((err) => {
                                //            console.error(err);
                                //        })
                                //    console.log('subbed user', subbedUser);
                                   
                                    // Add this subscriber to the interest
                                    // interest.subscribers.remove( subbedUser._id );

                                    // const saved = await interest.save()
                                    //     .then((nInterest) => {
                                    //         console.log('user removed from interest', nInterest);
                                    //         return { success: true };
                                    //     })
                                    //     .catch((err) => {
                                    //         console.log('error', err);
                                    //         return new UserInputError('Could not remove user from interest subscribers');
                                    //     });
                                    // return saved;
                                    return { success: true };
                                })
                                .catch((err) => {
                                    console.error(err);
                                    return new UserInputError('Could not ');
                                })
                            return saveSubscribe;
                        })
                        .catch(() => {
                            console.log('User does not have interest')
                            return new UserInputError('Already unsubscribed from '+slug);
                        })
                    return checkValid;
                })
                .catch((err) => {
                    console.error('what', err);
                    throw new UserInputError('Something went wrong while fetching user data.');
                })
            return output;
        } else {
            throw new UserInputError("Interest does not exist."); 
        }
    } else {
        throw new UserInputError("You must be logged in."); 
    }
}

module.exports.followUser = async (parent, params, { user }) => {
    const { userID } = params

    // Make sure user exists
    let loggedIn = await User.findOne({ _id: user.sub })
    let userExists = await User.findOne({ _id: userID })
    
    if (loggedIn && userExists) {
        // Then lets add this interest to the user
        // console.log('interest', interest);
        let subscriber = loggedIn
        let subscribee = userExists

        console.log('subscriber', subscriber.subscriptions);
        let isSubscribed = false;

        subscriber.subscriptions.forEach((following) => {
            if (following.type === 'user') {
                console.log('payload', following.payload)
                
                let userid = following.payload.get('user_id');
                if (userid === userID) {
                    console.log('following that user')
                    isSubscribed = true;
                }
            }
        })

        if (!isSubscribed) {
            subscriber.subscriptions.push({
                type: 'user',
                payload: {
                    user_id: userID
                }
            })

            return subscriber.save()
                .then(async (me) => {
                    console.log('user followed')
                    subscribee.followers.push({
                        user_id: subscriber._id
                    })

                    return subscribee.save()
                        .then(async (following) => {
                            let users = []
                            users.push(subscriber.id)
                            let subscriber_name = (subscriber['is_alias']) ? subscriber['alias'] : `${subscriber['first_name']} ${subscriber['last_name']}`
                            let sent = await sendOneAlert(subscribee, {
                                title: `${subscriber_name} started following you.`,
                                message: `${subscriber_name} started following you.`,
                                type: "newFollower",
                                link: `user:${subscriber['alias']}`,
                                users
                            })
                            return { success: true }
                        })
                        .catch((err) => {
                            console.log('error', err)
                            return new UserInputError('Could not follow user')
                        })
                })
                .catch(err => {
                    console.log('error', err)
                    return new UserInputError('Could not subscribe to user')
                })
        } else {
            console.log('already subscribed to user')
            return new UserInputError('Already subscribed to user');
        }
    } else {
        if (!loggedIn) {
            throw new UserInputError("You must be logged in."); 
        }

        if (!userExists) {
            throw new UserInputError("That user does not exist.")
        }
    }
}

module.exports.unfollowUser = async (parent, params, { user }) => {
    const { userID } = params

    // Make sure user exists
    let me = await User.findOne({ _id: user.sub })
  
    if (me) {
        // Then lets add this interest to the user
        // console.log('interest', interest);
        let subscriber = me
        let subscribee = await User.findOne({ _id: userID })

        console.log('subscriber', subscriber.subscriptions);
        let isSubscribed = false;

        subscriber.subscriptions.forEach((following) => {
            if (following.type === 'user') {
                console.log('payload', following.payload)
                
                let userid = following.payload.get('user_id');
                if (userid === userID) {
                    console.log('following that user')
                    isSubscribed = true;
                    subscriber.subscriptions.remove(following._id)
                }
            }
        })

        if (isSubscribed) {
            return subscriber.save()
                .then(async (me) => {
                    console.log('user followed', subscribee.followers)
                    subscribee.followers.forEach(a => { 
                        console.log('remove user', a.user_id, me._id)
                        if (a.user_id == me._id) {
                            console.log('removing follower', a._id)
                            subscribee.followers.remove(a._id)
                        }
                    })

                    return subscribee.save()
                        .then((following) => {
                            return { success: true }
                        })
                        .catch((err) => {
                            console.log('error', err)
                            return new UserInputError('Could not unfollow user')
                        })
                })
                .catch(err => {
                    console.log('error', err)
                    return new UserInputError('Could not unfollow to user')
                })
        } else {
            console.log('Already not following to user')
            return new UserInputError('Already not following to user');
        }
    } else {
        if (!me) {
            throw new UserInputError("You must be logged in."); 
        }
    }
}

module.exports.isBlocked = async (parent, params, { user }) => {
    const { type,
            id } = params
    let me = await User.findOne({ _id: user.sub })
    if(type === "user"){
        let blockList = [];
        var blockstate = true;
        for(const block_id of me['blockUsers']) {
            if(block_id == id){
                blockstate = false
            }else{
                blockList.push(block_id);
            }
        }
        if(blockstate)blockList.push(id)
        const newData = {}
        newData['blockUsers'] = blockList
        let block =  User.findOneAndUpdate({
            _id: user.sub
        },
        newData,
        {
            upsert: false,
            useFindAndModify: false
        },
        async ( err, doc ) => {
            if (err) {
                return new UserInputError("Error updating user data")
            } else {
                return { success: blockstate };
            }

           
        })
        return { success: blockstate};
        
    }else{
        let post = await PostM.findOne({ _id: id })
        var blockstate = true;
        let blockList = [];
        for(const block_id of post['blockUsers']) {
            if(block_id == user.sub){
                blockstate = false
            }else{
                blockList.push(block_id);
            }
        }
        if(blockstate)blockList.push(user.sub)
        const newData = {}
        newData['blockUsers'] = blockList
        let block =  PostM.findOneAndUpdate({
            _id: id
        },
        newData,
        {
            upsert: false,
            useFindAndModify: false
        },
        async ( err, doc ) => {
            if (err) {
                return new UserInputError("Error updating user data")
            } else {
                return { success: blockstate };
            }

           
        })
        return { success: blockstate};
    }
}

module.exports.blockUser = async (parent, { id }, { user }) => {
    let me = await User.findOne({ _id: user.sub })

    let blockList = []
    var blockstate = true

    for (const block_id of me['blockUsers']) {
        if (block_id == id) {
            blockstate = false
        } else {
            blockList.push(block_id);
        }
    }

    if (blockstate) blockList.push(id)

    const newData = {}
    newData['blockUsers'] = blockList
    
    let block =  User.findOneAndUpdate({
        _id: user.sub
    },
    newData,
    {
        upsert: false,
        useFindAndModify: false
    },
    async ( err, doc ) => {
        if (err) {
            return new UserInputError("Error updating user data")
        } else {
            return { success: blockstate };
        }

        
    })
    return { success: blockstate};
}

module.exports.inviteReferral = async (parent, params, { user, indices }) => {
    let userData = await User.findOne({ _id: user.sub })
    let nextuserLevel = userData['userLevel']+1;
    if(nextuserLevel === 4) nextuserLevel = 3;
    let levelData = await UserLevel.findOne({ userLevel: nextuserLevel});
    if (!userData) {
        return new UserInputError("Not authenticated.")
    }

    const { 
        phone_country_code, 
        phone, 
        first_name,
        last_name
    } = params;

    // Lets make sure user can invite people
    let count1 = await User.count({ ownerUserId: user.sub});
    let count2 = await Referral.count({ author: user.sub});

    let availableCount = userData['referrals_available'] - count1-count2;    
    if ( availableCount < 1) {
        return new UserInputError("You don't have any referrals left")
    }

    let referralExists = await Referral.findOne({ phone_country_code, phone })

    if (referralExists) {
        return new UserInputError("This user has already been invited.")
    }

    let referral_data = {
        full_phone_number: `${phone_country_code}${phone}`,
        phone_country_code,
        phone,
        author: user.sub,
        first_name,
        last_name,
        userLevel:levelData['userLevel'],
    }

    console.log('referral data', referral_data)

    let referral_create = new Referral(referral_data)

    let referral = await referral_create.save()
        .then(async saveData => {
            userData['referrals_available'] = userData['referrals_available'] - 1;
            await userData.save()

            let sendMessage = await client.messages 
                .create({         
                    to: `+${saveData['full_phone_number']}`,
                    messagingServiceSid: 'MG49bcbddefe60cc7a1d1d23c440f1b1cb', 
                    body: `You have been invited to Icered. Use your phone number to sign up at ${(process.env.NODE_ENV == 'production') ? 'https://iceredlive.page.link' : 'https://iceredstaging.page.link'}/welcome`
                })
                .then(message => console.log(message.sid)) 
                .catch(err => {
                    throw new UserInputError(err)
                })
                .done();
            // Lets send the twilio SMS message
            return saveData
        })
        .catch(err => {
            throw new UserInputError(err)
        })
    
        return { success: true }
}

module.exports.phoneContactUsers = async (parent, { contacts }, { user, indices }) => {
    // Lets make sure the user is logged in
    let userData = await User.findOne({ _id: user.sub })
    if (!userData) {
        return new UserInputError("Not logged in")
    }
    let result = await User.find({is_alias:false}).sort({_id: -1});
    let Users = [];
    contacts.map((phone, index) => {
        const found = result.find(element => element.full_phone_number ===  phone);
        if(found){
            
            Users.push(found);
        }
    })
    return Users;
}


module.exports.cancelReferral = async (parent, { phone_country_code, phone }, { user, indices}) => {

}