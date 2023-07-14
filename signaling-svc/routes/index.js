const axios = require('axios')
const cheerio = require('cheerio')
const router = require('express').Router();
const helpers = require('../helpers');
const twilio = require('twilio')
const tc = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const Interest = require('../models/Interest.model');
const Room = require('../models/Room.model');
const Country = require('../models/Country.model');
const { response } = require('express');
const algoliasearch = require('algoliasearch');
const UserModel = require('../models/User.model');
const Waitlist = require('../models/Waitlist.model')

const client = algoliasearch(process.env.ALGOLIA_CLIENT, process.env.ALGOLIA_SECRET);
const node_env = process.env.NODE_ENV
const indices = {
    posts: node_env !== "production" ? client.initIndex("dev_posts") : client.initIndex("prod_posts"),
    rooms: node_env !== "production" ? client.initIndex("dev_rooms") : client.initIndex("prod_rooms"),
    usersProfile: node_env !== "production" ? client.initIndex("dev_user_profiles") : client.initIndex("prod_user_profiles"),
    interests: node_env !== "production" ? client.initIndex("dev_interests") : client.initIndex("prod_interests")
}

const authenticateJWT = helpers.authenticateJWT;
const {
    checkIfInterestExists
} = helpers

router.post('/country', async (req, res) => {
    let country = new Country(req.body)
    const save = await country.save()
        .then(async (response) => {
            console.log('response', response)
            return response
        })
        .catch(err => {
            res.statusCode(400)
            return { Error: err.message }
        })
    return res.json(save)
})

router.put('/country', async (req, res) => {
    let {
        name,
        country_code,
        symbol,
        lang
    } = req.body

    let country = await Country.findOne({ symbol })
    name = (!name ? country['name'] : name)
    country_code = (!country_code ? country['country_code'] : country_code)
    symbol = (!symbol ? country['symbol'] : symbol)
    lang = (!lang ? country['lang'] : lang)

    let update = {
        symbol,
        name,
        country_code,
        lang
    }

    let returnData = await Country.findOneAndUpdate({ 
        symbol 
    }, 
    update, 
    {
        upsert: false,
        useFindAndModify: false
    }, 
    async (err, doc) => {

        if (err) {
            return {
                success: false
            }
        }
        console.log('country updated', doc)
        return {
            success: true,
            ...doc
        };
    })

    let statusCode = 200
    if (!returnData.success) {
        statusCode = 400
    }

    return res.status(statusCode).json(returnData)
})

router.get('/country/list', async (req, res) => {
    let countries = await Country.find();
    res.json(countries)
})

router.post('/interest', authenticateJWT, async (req, res) => {
    // Make sure we are an admin
    if (!req.user.sub) {
        return res.sendStatus(400).send("Not authorized")
    }
    console.log('req.user', req.user)
    let userData = await UserModel.findOne({ _id: req.user.sub })

    if (!userData['is_admin']) {
        return res.sendStatus(400).send("Not authorized")
    }

    let interest = new Interest(req.body);
    let interestIndex = indices.interests;

    const save = await interest.save()
        .then(async (doc) => {
            console.log('response data', doc);
            let indexData = {
                objectID: doc._doc._id,
                description: doc._doc.description,
                label: doc._doc.label,
                parents: doc._doc.parents,
                image_url: doc._doc.image_url,
                type: doc._doc.type,
                slug: doc._doc.slug,
                news_category: doc._doc.news_category
                
            }
            interestIndex.saveObject(indexData)
            return doc;
        })
        .catch(err => {
            // console.error(err);
            return { Error: err };
        })
    res.json(save);
})

router.put('/interest', authenticateJWT, async (req, res) => {
    let {
        slug,
        label,
        description,
        category,
        image_url,
        news_category,
        news_queries,
        parents,
        type
    } = req.body;

    let interestIndex = indices.interests

    let interest = await Interest.findOne({ slug })
    label = (!label ? interest['label'] : label)
    description = (!description ? interest['description'] : description)
    category = (!category ? interest['category'] : category)
    news_category = (!news_category ? interest['news_category'] : news_category)
    news_queries = (!news_queries ? interest['news_queries'] : news_queries)
    image_url = (!image_url ? interest['image_url'] : image_url)
    parents = (!parents ? interest['parents'] : parents)
    type = (!type ? interest['type'] : type)

    // Make sure all parent categories are valid
    if (parents.length > 0) {
        let new_parents = []
        let errs = []
        parents.forEach(async parent => {
            await checkIfInterestExists(parent)
                .then(r => {
                    console.log('r', r)
                    if (r['type'] == 'forum') {
                        new_parents.push(parent)
                    } else {
                        errs.push({ error: `${r['slug']} is not a forum. Only forums can be parents.`})
                    }
                }).catch(err => {
                    console.log('uh oh, this isnt an interest', parent)
                    errs.push({error: err})
                })
        })
        if (errs.length > 0) {
            return res.sendStatus(400).json({error: "Error updating interest.", errors: errs})
        }
        parents = new_parents;
    }

    // make sure type can only be interest or forum
    if (type !== 'interest' && type !== 'forum' && !type) {
        console.log("errored type", type)
        throw res.sendStatus(400).json({err: "invalid interest type: " + type})
    }

    let update = {
        slug,
        label,
        description,
        category,
        news_category,
        image_url,
        news_queries,
        parents,
        type
    }

    let returnData = await Interest.findOneAndUpdate({ 
        slug 
    }, 
    update, 
    {
        upsert: false,
        useFindAndModify: false,
        returnOriginal: false
    }, 
    async (err, doc) => {

        if (err) {
            return {
                success: false
            }
        }
        console.log('interest updated', doc)
        // lets update the index
        let indexData = {
            objectID: doc._doc._id,
            description: doc._doc.description,
            label: doc._doc.label,
            parents: doc._doc.parents,
            image_url: doc._doc.image_url,
            type: doc._doc.type,
            slug: doc._doc.slug,
            news_category: doc._doc.news_category
            
        }
        let savedInterest = await interestIndex.saveObject(indexData)

        return {
            success: true,
            ...doc._doc
        };
    })

    let statusCode = 200
    if (!returnData.success) {
        statusCode = 400
    }

    return res.status(statusCode).json(returnData)
})

router.get('/interest/list', async (req, res) => {
    let interests = await Interest.find();
    res.json(interests.filter(interest => {
        if (interest['image_url'] !== "") {
            return interest
        }
    }));
})

// User wants to join room
router.get('/room/:room', async (req, res) => {
  const roomId = req.params.room
  const room = await Room.find({ _id: roomId })
  const roomData = { roomId }
  res.render('room', roomData)
})

router.put('/interest/index', async (req, res) => {
    // Lets update the index
    if (!req.user.sub) {
        return res.sendStatus(400).json({error: "Not authorized"})
    }

    let userData = await UserModel.findOne({ _id: req.user.sub })

    if (!userData) {
        console.log('user does not exist')
        return res.sendStatus(400).json({ error: "Not authorized"})
    }

    if (!userData['is_admin']) {
        console.log('user must be admin')
        return res.sendStatus(400).json({ error: "Not authorized"})
    }

    let interestIndex = indices.interests

    let interests = await Interest.find({})
    let interestData;
    let datas = []
    let saved

    interests.forEach(async interest => {
        interestData = {
            objectID: interest._id,
            description: interest.description,
            label: interest.label,
            parents: interest.parents,
            image_url: interest.image_url,
            type: (!interest.type ? 'interest' : interest.type),
            slug: interest.slug,
            category: interest.category,
            news_category: interest.news_category,
            createdAt: interest.createdAt
        };
        console.log('interest', interestData)
        saved = await interestIndex.saveObject(interestData)
        datas.push(interestData)
    })

    return res.json(datas)
})

router.post('/waitlist/join', async (req, res) => {
    let {
        phone_country_code,
        phone
    } = req.body

    if (!phone_country_code || !phone) {
        res.statusCode = 400
        return res.json({ success: false, error: "Must include full phone number"})
    }

    phone_country_code = (!phone_country_code ? null : phone_country_code)
    phone = (!phone ? null : phone)

    let data = {
        phone_country_code,
        phone,
        full_phone_number: `${phone_country_code}${phone}`
    }

    let entry = new Waitlist(data)

    let success = await entry.save()
        .then(async saved => {
            console.log('saved', saved)
           
            let sendMessage = await client.messages 
                .create({         
                    to: `+${saved['full_phone_number']}`,
                    messagingServiceSid: 'MG49bcbddefe60cc7a1d1d23c440f1b1cb', 
                    body: `Thank you for joining the Icered waitlist. We'll shoot you a text when its your turn to join!`
                }) 
                .then(message => console.log(message.sid)) 
                .catch(err => {
                    console.log(err)
                    res.statusCode = 400
                    throw res.json("Something went wrong, we couldn't send you a text message but you were still added to our waitlist!")
                })
                .done();

            return saved
        })
        .catch(err => {
            res.statusCode = 400
            throw res.json(err)
        })
    res.json({ success: true })
})

router.get('/environment', async (req, res) => {
    res.json({ version: process.env.VERSION, environment: process.env.NODE_ENV})
})

router.post('/fetch', async (req, res) => {
    const url = req.body.url
    let returnThis = await axios.get(url).then( data => {
       // console.log(data)
        let html = data.data
        let $ = cheerio.load(html)
        let images = []

        let page_images = $('img')
        page_images.each((i) => {
            let img = page_images[i]
            images.push($(img).attr('src'))
        })

        let description = $('meta[name="description"]')
        if (description) {
            description = description.attr('content')
        }

        return ({
            title: $('title').text().replace(/\\n/g, "\n").trim(),
            images,
            description
        })
    })
    // Lets fetch the link data
    return res.json(returnThis)
})
module.exports = router;
