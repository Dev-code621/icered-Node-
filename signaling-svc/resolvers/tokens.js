const apollo = require('apollo-server-express');
const User = require('../models/User.model');
const tokenHelper = require('../helpers/tokens.helper');

const UserInputError = apollo.UserInputError;

module.exports.tipUser = async (parent, params, { user }) => {
    let tipper = await User.findOne({ _id: user.sub })

    if (!tipper) {
        return new UserInputError("Not logged in")
    }

    if (tipper['is_alias']) {
        tipper = await User.findOne({ _id: tipper['alias_owner'] })
    }
    
    let {
        amount,
        userID
    } = params

    if (!amount) {
        amount = 0.01
    }

    let recipient = User.findOne({ _id: userID})

    if (!recipient) {
        return new UserInputError("Recipient doesn't exist. They may be deleted.")
    }

    // convert alias to real user if true
    if (recipient['is_alias']) {
        recipient = await User.findOne({ _id: recipient['alias_owner'] })
    }

    if (recipient['_id'] === tipper['_id']) {
        return new UserInputError("You can't tip yourself.")
    }

    if (tipper.tokens < amount) {
        return new UserInputError("Insufficient token balance")
    }

    let granted = await tokenHelper
        .grantTokens(recipient['_id'])
        .then(grantedAmount => {
            return grantedAmount
        })
        .catch(err => { 
            console.log('error tipping recipient', err)
            return false
         })
    
    if (granted) {
        tipper.tokens -= amount;

        tipper.logs.push({
            type: 'tip_user',
            message: `Sent a tip to ${recipient['_id']}`
        })
        
        await tipper.save()
 
        return { success: true }
    } else {
        return new UserInputError("An error occured while trying to tip author")
    }
    
}