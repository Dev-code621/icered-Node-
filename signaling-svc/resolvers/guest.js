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
    sendAlerts
} = require('../helpers/alerts.helper')

const { 
    generateSixDigitCode, 
    createPasscodeAction,
    doCodeAction
} = require("../helpers")

const Guest = require('../models/Guest.model')
const User = require('../models/User.model')

const e = require('express')

const checkIfUserHasInterest = helpers.checkIfUserHasInterest
const UserInputError = apollo.UserInputError

// Set sendgrid api key
sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  
const generateTokens = async (userID, permissions, roles, removeRefreshToken) => {
    return new Promise(async (resolve, reject) => {
        let guest = await Guest.findOne({ _id: userID})

        if (guest) {
            let refreshToken = {
                token: randtoken.uid(256),
                expires: (Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
            let refreshTokens = guest['refreshTokens']
            let webTokens = guest['webTokens']

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
                    issuer:'Guest',
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

            await guest.updateOne({ _id: userID }, {
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

module.exports.guestLogin = async (parent, { deviceID}) => {
   
    let result = await Guest.findOne({ deviceID: `${deviceID}` })
    if(result === null){
        let guest = new Guest({            
            deviceID: `${deviceID}`
        })
       result = await guest.save()
        .then(async (response) => {
            return response
        })
        .catch(err => {
            throw new UserInputError(err)
        });
    }
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
}
