const helpers = require('../helpers');
const User = require('../models/User.model');

const authenticateJWT = helpers.authenticateJWT;

const router = require('express').Router();
const algoliasearch = require('algoliasearch');
const client = algoliasearch(process.env.ALGOLIA_CLIENT, process.env.ALGOLIA_SECRET);

const node_env = process.env.NODE_ENV
const indices = {
    posts: node_env !== "production" ? client.initIndex("dev_posts") : client.initIndex("prod_posts"),
    rooms: node_env !== "production" ? client.initIndex("dev_rooms") : client.initIndex("prod_rooms"),
    usersProfile: node_env !== "production" ? client.initIndex("dev_user_profiles") : client.initIndex("prod_user_profiles"),
    interests: node_env !== "production" ? client.initIndex("dev_interests") : client.initIndex("prod_interests")
}

router.patch(
    '/reindex/:fn', 
    authenticateJWT,
    async (req, res) => {
        console.log('req params', Object.keys(req))
        // Subscribe a user to an interest
        const {
            clearFirst,
            skipBots,
            skipAliases
        } = req.body;

        const fn = req.params.fn

        if (req.user.sub) {
            // Find the user
            let user = await User.findOne({ _id: req.user.sub })
            console.log('user', user);

            if (!user['is_admin'] && !user['is_developer']) {
                res.status(400)
                return res.json({
                    success: false,
                    error: {
                        message: "Permission denied."
                    }
                })
            }

            // Lets call the right function
            switch(fn) {
                case 'users':
                    console.log('run user reindex function')
                    const { usersProfile } = indices;

                    usersProfile.clearObjects().then(async () => {
                        console.log('objects cleared, now lets reindex')
                        let users = await User.find({ is_bot: false })

                        // cycle through each user and add profile to index
                        users.forEach(async (user) => {
                            let userProfileData = {
                                objectID: user['_id'],
                                _id: user['_id'],
                                id: user['_id'],
                                first_name: user['first_name'],
                                last_name: user['last_name'],
                                alias: user['alias'],
                                location: user['location'],
                                email: user['email'],
                                phone: user['phone'],
                                profile_photo_url: user['profile_photo_url'],
                                interests: user['interests'],
                                anonymous: user['anonymous'],
                                following: user['following'],
                                followers: user['followers'],
                                date: user['date'],
                                last_active: user['last_active'],
                                full_phone_number: user['full_phone_number'],
                                country_code: user['country_code']
                            }
                            let addObject = await usersProfile.saveObject(userProfileData)
                        })
                    })
                break;
                case 'posts':
                    console.log('run posts reindex function')
                break;
            }

            return res.json({
                success: true
            })
        } else {
            res.json({ success: false, error: { message: 'Missing auth token.' }})
        }
    }
);

module.exports = router;