const jwt = require('jsonwebtoken')
const randtoken = require('rand-token')
const helpers = require('../helpers')
const apollo = require('apollo-server-express')

const User = require('../models/User.model')
const UserInputError = apollo.UserInputError

module.exports.createAlias = async (parent, params, { user, indices }) => {
    let owner = await User.findOne({ _id: user.sub})
    if (owner) {
        if (owner['is_alias']) {
            return {
                success: false,
                message: 'Alias accounts cannot create other alias accounts.'
            }
        }
        // Find the current alias accounts
        let aliases = await User.find({ alias_owner: user.sub })
        let { usersProfile } = indices;
        console.log('owner========', aliases.length)

        if (aliases.length < 3) {
            let {
                alias,
                first_name,
                last_name,
                profile_photo_url,
                phone_country_code
            } = params;

            // Check to see if alias already exists
            let aliasExists = await User.findOne({ alias })

            if (aliasExists) {
                return {
                    success: false,
                    message: "That alias name is already taken."
                }
            }

            profile_photo_url = (!profile_photo_url ? 'https://icered-images.s3.amazonaws.com/6d5ddadf-df9d-4521-b11b-94a5adadbcdc.jpeg' : profile_photo_url)
            phone_country_code = (!phone_country_code ? owner['phone_country_code'] : phone_country_code)
            let err = false
            if (!alias) {
                err = "A unique alias name is required."
            }

            if (!first_name) {
                err = "First name is required for alias accounts."
            }

            last_name = (!last_name ? "" : last_name)

            if (err) {
                return new UserInputError(err)
            }

            let interests = owner['interests']
            
            let data = {
                alias,
                first_name,
                last_name,
                profile_photo_url,
                is_alias: true,
                alias_owner: user.sub,
                status: true,
                phone_country_code,
                interests
            }

            let Alias = new User(data)
            let status = await Alias.save()
                .then(async aliasData => {
                    console.log('saved', aliasData)
                    let doc = aliasData
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
                    console.log('save to algolia', save)
                    let saveIndex = await usersProfile.saveObject({
                        objectID: user.sub,
                        ...save
                    })
                    return {
                        success: true
                    }
                })
                .catch(err => {
                    return new UserInputError(err)
                })
            return status;
        } else {
            return new UserInputError("Alias account limit reached.")
        }
    } else {
        return new UserInputError({ error: {
            message: "Invalid auth token."
        }})
    }
}

module.exports.listAliases = async (parent, params, { user }) => {
    let owner = await User.findOne({ _id: user.sub})

    if (owner) {
        let aliases = await User.find({
            alias_owner: user.sub,
            is_alias: true
        })

        console.log('aliases', aliases)

        return aliases;
    } else {
        return new UserInputError("Invalid user; Authentication error.")
    }
}

module.exports.AllAliases = async (parent, params, { user }) => {
    let owner = await User.findOne({ _id: user.sub})
    if (!owner) {
        return new UserInputError("Not logged in")
    }
    let aliases = await User.find({       
        is_alias: true
    })
    return aliases;
}

module.exports.editAlias = async ( parent, attr, { user, indices }) => {
 let aliasID = attr.id;
    let { usersProfile } = indices;
 if (!aliasID) {
     return new UserInputError("`id` is a required parameter.")
 }

 let exists = User.exists({ _id: user.sub })

 if (!exists) {
     return new UserInputError("User does not exist");
 }

 const newData = {}
 let allowed = [
     'first_name',
     'last_name',
     'alias',
     'phone_country_code',
     'status',
     'profile_photo_url'
 ];

 allowed.forEach((val, key) => {
     if (attr[val]) {
         newData[val] = attr[val]
     }
 })
 newData['status'] = attr['status']
 let alias = await User.findOne({ _id: aliasID, alias_owner: user.sub })
 if (alias) {
    return User.findOneAndUpdate({
        _id: alias['_id'],
        alias_owner: user.sub
    },
    newData,
    {
        upsert: false,
        useFindAndModify: false
    },
    async ( err, doc ) => {
        if (err) {
            return new UserInputError("Error updating alias data")
        } else {
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
                status:doc._doc.status,
                full_phone_number: doc._doc.full_phone_number
            }
            let saveIndex = await usersProfile.saveObject({
                objectID: alias['_id'],
                ...save
            })
            console.log('alias saved', saveIndex)
        }
        return doc
    })
 } else {
     return new UserInputError("Alias account does not exist")
 }
}

module.exports.deleteAlias = async ( parent,  { id }, { user, indices }) => {
    // get the alias data
    let { usersProfile } = indices;
    let status = await User.findOneAndDelete(
            { 
                _id: id, alias_owner: user.sub
            }
        )
        .then(async (status) => {
            await usersProfile.deleteObject(id)
            return { success: true }
        })
        .catch(err => {
                console.log('error', err)
                return new UserInputError("Error deleting alias");
        })
    
    return status

}

const generateToken = async ({
    token,
    subject
}) => {
    return new Promise(async (resolve, reject) => {
        let user = await User.findOne({ _id: subject })

        if (!user) {
            return reject('User not found')
        }

        let webTokens = (!user['webTokens'] ? [] : user['webTokens'])

        let aliasToken = jwt.sign(
            {
                "permissions" : {
                    roles: null,
                    permissions: null
                }
            },
            process.env.JWT_SECRET,
            {
                algorithm: "HS256",
                subject
            }
        );
        console.log('aliasToken', aliasToken)
        webTokens.push({
            token: aliasToken,
            linked_token: token,
            expires: null
        })

        await User.updateOne({
            _id: subject
        }, {
            webTokens
        });

        resolve({
            token: aliasToken
        })
    })
}

module.exports.getAliasToken = async (parent, { id }, { req, user }) => {
    let owner = await User.findOne({ _id: user.sub })
    
    if (!owner) {
        return new UserInputError("Not authenticated")
    } else {
        let Alias = await User.findOne({ _id: id, alias_owner: user.sub })
        if (!Alias) {
            return new UserInputError("Not authorized")
        }

        if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            let token = req.headers.authorization.split(' ')[1]
            console.log('token', token)

            let aliasToken = await generateToken({
                subject: id,
                token
            }).then(async result => {
                return {
                    jwt: result.token
                }
            }).catch(err => {
                return new UserInputError(err)
            })

            return aliasToken
        }
    }
}
