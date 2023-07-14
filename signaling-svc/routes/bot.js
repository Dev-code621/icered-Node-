const helpers = require('../helpers');
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const authenticateJWT = helpers.authenticateJWT;

const router = require('express').Router();

router.post('/auth', async (req, res) => {
    // This does nothing yet (: but will be for providing an oAuth 2.0 authorization scope for bots when it involves user assets such as rooms
})

const generateToken = async (subject) => {
    return new Promise(async (resolve, reject) => {
        let user = User.findOne({ _id: subject })
       
        if (user) {
            let webTokens = (!user['webTokens'] ? [] : user['webTokens']) 
            
            let token = jwt.sign(
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
            webTokens.push({
                token,
                linked_token: null,
                expires: null
            })

            console.log('token', token)
            
            await User.updateOne({ 
                    _id: subject 
                },{
                    webTokens
                });
            
            resolve({
                token
            })
        } else {
            res
                .status(400)
                .json({
                    err: {
                        message: "User not found."
                    }
                })
        }
    })
}


router.get('/list', authenticateJWT, async (req, res) => {
    console.log('sup')
     // console.log('user', req.user.sub)
    let user = await User.findOne({ _id: req.user.sub })

    if (user) {
        // Get the bots
        let bots = await User.find({
            bot_admin: req.user.sub,
            is_bot: true
        })

        // Just list them if there are any
        let return_bots = []
        console.log('bots', bots)
        bots.forEach(bot => {
            console.log('bot', bot)
            return_bots.push({
                id: bot['_id'],
                name: bot['alias'],
                description: bot['bio'],
                profile_photo_url: bot['profile_photo_url'],
                country_code: bot['phone_country_code']
            })
        })

        res.json(return_bots)
    } else {
        res
            .status(400)
            .json({
                err: {
                    message: "User not found."
                }
            })
    }
})

router.post('/:id/auth/token', authenticateJWT, async (req, res) => {
    let user = await User.findOne({ _id: req.user.sub })
    if (user) {
        let bot_id = req.params.id
        let bot = await User.findOne({ 
            _id: bot_id,
            bot_admin: user['_id']
        })

        if (bot) {
            let generatedTokenResults = await generateToken(bot_id)
                .then(async tokens => {
                    return tokens
                })
                .catch(err => { 
                    res.status(400)
                    return err 
                })
            return res.json(generatedTokenResults)
        } else {
            res
                .status(400)
                .json({
                    err: {
                        message: "Bot not found."
                    }
                })
        }
    } else {
        res
            .status(400)
            .json({
                err: {
                    message: "User not found."
                }
            })
    }
   
})

router.get('/:id/auth/tokens', authenticateJWT, async (req, res) => {
    let bot_id = req.params.id
    let user = await User.findOne({ _id: req.user.sub })

    if (user) {
        let bot = await User.findOne({ _id: bot_id, bot_admin: user['_id'] })

        if (bot) {
            console.log('bot', bot)
            return res.json({ tokens: bot['webTokens'] })
        } else {
            // Bot not found
            res.status(400).json({
                err: {
                    message: "Bot not found."
                }
            })
        }
    } else {
        // user not found
        res.status(400).json({
            err: {
                message: "User not found."
            }
        })
    }
})

router.delete('/:id/auth/token', authenticateJWT, async (req, res) => {
    let token_id = req.body.token
    let bot_id = req.params.id

    let user = await User.findOne({ _id: req.user.sub })

    if (user) {
        let bot = await User.findOne({ _id: bot_id, bot_admin: user['_id'] })
        console.log('bot', bot)
        if (bot) {
            bot['webTokens'].forEach(token => {
                if (token['_id'] !== token_id) {
                    bot.webTokens.remove(token['_id'])
                }
            })
            await bot.save()

            console.log('finished')
            res.json({success: true})
        } else {
            // Bot not found
            res.status(400).json({
                err: {
                    message: "Bot not found."
                }
            })
        }
    } else {
        // User not found
        res.status(400).json({
            err: {
                message: "User not found."
            }
        })
    }
})

router.get('/:id', async (req, res) => {
    let bot_id = req.params.id
    let bot = await User.findOne({ _id: bot_id })

    if (bot) {
        let data = {
            id: bot['_id'],
            _id: bot['_id'],
            name: bot['alias'],
            description: bot['bio'],
            profile_photo_url: bot['profile_photo_url'],
            country_code: bot['phone_country_code']
        }

        res.json(data)
    } else {
        res.status(400).json({
            err: {
                message: "Bot not found."
            }
        })
    }
})

router.delete('/delete/:id', authenticateJWT, async (req, res) => {
    let user = await User.findOne({ _id: req.user.sub })
    if (user) {
        let { id } = req.params

        let Bot = await User.findOneAndDelete({
            _id: id, 
            bot_admin: user['_id'] 
        }, async (err, docs) => {
            if (err) {
                return res.status(400).json(err)
            }

            console.log('docs', docs)
            res.json({success: true})
        })
    }
})

router.put('/edit/:id', authenticateJWT, async (req, res) => {
    let user = await User.findOne({ _id: req.user.sub })
    if (user) {
        // Get the bot
        let {
            id
         } = req.params
         let bot_id = id;
        let Bot = await User.findOne({ _id: bot_id })
        // Lets make sure we are the bot admin
        if (Bot['bot_admin'] == req.user.sub) {
            // Now we can actually edit the bot
            let {
                name,
                description,
                profile_photo_url,
                country_code
            } = req.body

            name = (!name ? Bot['alias'] : name)
            description = (!description ? Bot['bio'] : description)
            profile_photo_url = (!profile_photo_url ? Bot['profile_photo_url'] : profile_photo_url)
            country_code = (!country_code ? Bot['country_code'] : country_code)

            let data = {
                alias: name,
                bio: description,
                profile_photo_url,
                country_code
            }

            console.log('updating bot: ' + bot_id)
            return User.findOneAndUpdate({
                        _id: bot_id 
                },  data, {
                    upsert: false,
                    useFindAndModify: false
                }, async (err, doc) => {
                    if (err) {
                        return res.status(400).json(err)
                    }

                    console.log('updated bot', doc)
                    return res.json(data)
                })
                   
        } else {
            res
                .status(400)
                .json({
                    err: {
                        message: "Insufficient permissions. This isn't your bot."
                    }
                })
        }
    } else {
        res
            .status(400)
            .json({
                err: {
                    message: "User not found."
                }
            })
    }
})

router.post('/create', authenticateJWT, async (req, res) => {
    // Lets get the user
    let user = await User.findOne({ _id: req.user.sub})
    if (user) {
        // Only a developer can create a bot
        console.log(user)
        if (user['is_developer']) {
            let {
                name,
                description,
                profile_photo_url,
                country_code
            } = req.body

            if (!name) {
                return res.status(400).json({
                    err: {
                        message: "Please name your bot",
                        missing: "`name`"
                    }
                })
            }
            if (!description) {
                return res.status(400).json({
                    err: {
                        message: "Please describe your bot",
                        missing: "`description`"
                    }
                })
            }
            if (!country_code) {
                return res.status(400).json({
                    err: {
                        message: "Please provide a numeric country code (phone number based) to indicate where your bot will post to",
                        missing: "`name`"
                    }
                })
            }

            profile_photo_url = (!profile_photo_url ? 'https://icered-images.s3.amazonaws.com/6d5ddadf-df9d-4521-b11b-94a5adadbcdc.jpeg' : profile_photo_url)

            let data = {
                alias: name,
                bio: description,
                profile_photo_url,
                phone_country_code: country_code,
                is_bot: true,
                bot_admin: req.user.sub
            }

            let Bot = new User(data)
            await Bot.save()
                .then(botData => {
                    console.log('saved', botData)

                    // Lets generate an API key for this bot

                    res.json({
                        id: botData['_id'],
                        _id: botData['_id'],
                        ...data
                    })
                })
                .catch(err => {
                    console.log(err)
                    res.json(err)
                })

        } else {
            res.status(400)
            res.json({
                err: {
                    message: "Insufficient permission. Only developers can create bots"
                }
            })
        }
    } else {
        res.statusCode(400)
        res.json({
            err: {
                message: "User not found."
            }
        })
    }
})

module.exports = router;