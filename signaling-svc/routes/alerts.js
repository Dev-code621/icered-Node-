const router = require('express').Router();
const jwt = require('jsonwebtoken');

const admin = require("../firebase.db");

const { authenticateJWT } = require('../helpers');
const User = require('../models/User.model');


router.post('/sendAlerts', async (req, res) => {
    const {
        function_name,
        data,
        subscribers
    } = req.body;
    
    let payload = {
        notification: {
            body: data.message,
            title: data.title
        }
    }

    if (data.icon) {
        payload.notification['icon'] = data.icon
    }

    switch(function_name) {
        case 'friend_is_live':
           
        break;
        case 'subscription_is_live':

        break;
        case 'new-like':

        break;
        case 'new-subscriber':

        break;
        case 'new-reply':

        break;
        default:
            
        break;
    }

    // Now that we have began crafting the notification,
    // Lets loop through subscribers and get all devices
    
    let tokens = [];

    subscribers.forEach(async (subscriber_id) => {
        let subscriber = await User.findOne({ _id: subscriber_id })
        
        // Lets store this alert and then send push notifications
        subscriber.alerts.push({
            message: data.message,
            title: data.title,
            subtext: data.subtext,
            link: data.link,
            link_type: data.link_type,
            icon: data.icon,
            read: data.read
        })
        const saveSubscriber = await subscriber.save()
            .then(async )

        if (subscriber.devices.length > 0) {
            subscriber.devices.forEach(device => {
                console.log('sending to device', device)
                tokens.push(device.token)
            })
        } else {
            console.log('User has no devices', subscriber)
        }
    })

    if (tokens.length > 0) {
        admin.messaging().sendToDevice(tokens, payload)
    }
})


module.exports = router;