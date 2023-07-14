const apollo = require('apollo-server-express')
const UserInputError = apollo.UserInputError
const { withFilter } = require('graphql-subscriptions')

const User = require('../models/User.model')
const Alert = require('../schemas/Alert.schema')
const { sendOneAlert } = require('../helpers/alerts.helper')

module.exports.alerts = async (parent, { type, read, since } , { user }) => {
    let query = { 
        _id: user.sub
    }

    let userData = await User.findOne(query);
    if (!userData) {
        return new UserInputError('Not authenticated')
    }

    let alerts = []

    if (userData) {
        userData['alerts'].forEach((alertx, i) => {
            let alert = userData['alerts'][(userData['alerts'].length - 1) - i]
            console.log('this alert', alert)
            let time = new Date(alert.createdAt).getTime()
            console.log((parseInt(time) <= parseInt(since)), time, since)
            if (since && (parseInt(time) <= parseInt(since))) {
                    return true
            } else {
                if (!type && !read) {
                    alerts.push(alert)
                } else if(!type) {
                    if (alert.read == read) {
                        alerts.push(alert)
                    }
                }  else if (alert.type == type) {
                    alerts.push(alert)
                } else {
                    console.log('nothing to do with this one', alert)
                }
            }
        })
    }
   // console.log(userData['alerts'])
    console.log('query', query)
    return alerts
    
}

module.exports.testAlert = async (parent, { id }, { user }) => {
    let userData = await User.findOne({ _id: user.sub })
    if (!userData) {
        return new UserInputError(`Not authenticated.`)
    }

    let alert = {
        message: `Just a test`,
        title: `Testing alert.`,
        type: `test`
    }

    let alertSent = await sendOneAlert(userData.id, alert)    

    if (alertSent) {
        return { success: true }
    } else {
        return { success: false }
    }
}

module.exports.readAlert = async (parent, { id }, { user }) => {
    let userData = await User.findOne({ _id: user.sub })
    let success = false
    if (userData) {
        let alerts = userData['alerts']
        alerts.forEach((alert, i) => { 
            if (alert['_id'] == id) {
                alert.read = true
                userData['alerts'][i] = alert
                success = true
            }
        })

        if (success) {
            let status = await userData.save()
            .catch((err) => {
                throw UserInputError(err)
            })

            return { success }
        } else {
            return { success: false }
        }
    } else { 
        return new UserInputError("Not authenticated")
    }
}

module.exports.subscriptions = {
    Notifications: {
        subscribe: withFilter(
            (parent, args, context) => {
                console.log('the context for user', parent, args)
                const { pubsub } = context
                return pubsub.asyncIterator([
                    'NOTIFICATION_RECEIVED'
                ])
            },
            async (payload, variables) => {
                console.log('payload', payload)
                console.log('variables', variables)

                return true
            }
        )
    }
}