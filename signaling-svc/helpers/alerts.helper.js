const admin = require("firebase-admin")
const serviceAccount = require("../firebase.serviceAccount.json")
const Alert = require('../schemas/Alert.schema')
const User = require('../models/User.model')
const { UserRef } = require("../resolvers")

module.exports.sendAlerts =  async (recipients, data) => {
    let {
        message,
        title,
        subtext,
        link,
        link_type,
        icon
    } = data

    let tokens = [];

    // Payload for push notifications
    let payload = {
        notification: {
            body: message,
            title
        }
    }

    if (data.icon) {
        payload.notification['icon'] = data.icon
    }
 
    switch(data.type) {
        case "approved":
            recipients.followers.forEach(async (recipient_id) => {

                let recipient = await User.findOne({ _id: recipient_id.user_id })
        
                // Lets store this alert and then send push notifications
                recipient.alerts.push({
                    message,
                    title,
                    subtext: data.subtext,
                    link: data.link,
                    link_type: data.link_type,
                    icon: data.icon,
                    read: data.read,
                    type: data.type
                })
                const saveRecipient = await recipient.save()
        
                // this sends to all devices by the recipient
                if (recipient.devices.length > 0) {
                    recipient.devices.forEach(device => {
                        console.log('sending to device', device)
                        tokens.push(device.token)
                    })
                } else {
                    console.log('User has no devices', recipient)
                }
            })
        break;
        case "comment":
    
            // Lets store this alert and then send push notifications
            recipients.alerts.push({
                message,
                title,
                subtext: data.subtext,
                link: data.link,
                link_type: data.link_type,
                icon: data.icon,
                read: data.read,
                type: data.type
            })
            const saveRecipient = await recipients.save()

            // this sends to all devices by the recipient
            if (recipients.devices.length > 0) {
                recipients.devices.forEach(device => {
                    console.log('sending to device', device)
                    tokens.push(device.token)
                })
            } else {
                console.log('User has no devices', recipient)
            }
        break;
        case "room":

        break;
    }
    
    
    if (tokens.length > 0) {
        admin.messaging().sendToDevice(tokens, payload)
    }
}

const GetSocialCircle = user => {
    return new Promise(async (resolve, reject) => {
        let returnThis = []
        let users = {}
        let followingUsers = []

        user.subscriptions.forEach(subscription => {
            if (subscription.type == 'user') {
                let userid = subscription.payload.get('user_id')
                console.log('usesr id is', userid)
                users[userid] = true
                followingUsers.push(userid)
            }
        })

        user.followers.forEach(follower => {
            if (users[follower.user_id]) {
                returnThis.push(follower.user_id)
            }
        })

        resolve({ 
            socialCircle: returnThis, 
            followingUsers
        })
    })
};

module.exports.GetSocialCircle = GetSocialCircle

// Send an alert to a user
module.exports.sendOneAlert =  (recipientId, data) => {
    return new Promise(async (resolve, reject) => {
        let recipient
        if (recipientId['_id']) {
            recipient = recipientId
        } else {
            recipient = await User.findOne({ _id: recipientId })
        }

        if (!recipient) {
            reject('Unable to locate user.')
        }

        let alert = data

        let tokens = [];

        // Payload for push notifications
        let payload = {
            notification: {
                body: data.message,
                title: data.title,
                link: data.link,
                type: data.type
            },
            data: {
                link: data.link,
                type: data.type
            }
        }
        recipient['alerts'] = recipient['alerts'] ? recipient['alerts'] : []
        recipient['alerts'].push(alert)
        let saved = await recipient.save()
            .then((s) => resolve)
            .catch((err) => reject(err))

        // this sends to all devices by the recipient
        if (recipient.devices.length > 0) {
            recipient.devices.forEach(device => {
                console.log('sending to device', device)
                tokens.push(device.token)
            })
        } else {
            console.log('User has no devices', recipient)
        }

        if (tokens.length > 0) {
            admin.messaging().sendToDevice(tokens, payload)
            console.log('sent payload to devices', payload)
        }

        resolve(saved)
    })
}
