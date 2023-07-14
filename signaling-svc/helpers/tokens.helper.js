const User = require('../models/User.model')

module.exports.grantTokens = (userID, type, amount = null) => {
    return new Promise(async (resolve, reject) => {
        let user = await User.findOne({ _id: userID })

        if (!user) {
            console.log('User does not exist')
            return reject('User does not exist');
        }

        // Is this user a bot?
        if (user['is_bot']) {
            return reject('Bots cannot earn tokens')
        }

        if (!amount) {
            return reject('Must specify amount.')
        }

        // Is the user an alias?
        if (user['is_alias']) {
            user = await User.findOne({ _id: user['alias_owner'] })
            if (!user) {
                return reject('User does not exist.')
            }
        }
        
        switch (type) {
            case 'tip_user':
                logFor = `got ${amount} tokens as a tip from <@${user['_id']}> for as a tip.`
            break;
            default:
                logFor = `got ${amount} tokens from Icered.`
        }
    

        if (amount <= 0) {
            return resolve('Amount must be greater than 0.')
        }

        // Grant token to user
        user['tokens'] += amount;
        console.log('new token amount', user['tokens'])
        user.logs.push({
            type: "token-grant",
            message: logFor
        })
        let save = await User.findOneAndUpdate({ 
                _id: userID 
            }, 
            user, 
            {
                upsert: false,
                useFindAndModify: true
            }, 
            async (err, doc) => {
                if (err) {
                    reject(err)
                }

                resolve(amount);  
            })
    })
}