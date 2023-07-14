const jwt = require('jsonwebtoken');

const Interest = require('../models/Interest.model');
const User = require('../models/User.model');
const Report = require('../models/Reports.model');

module.exports.createReport = (params) => {
    const {
        code, 
        description,
        content_type,
        content_author,
        content_data ,
        author,
        logs,
        ip_address
    } = params;
    return new Promise(async (resolve, reject) => {
        
        let report = new Report({
            code,
            description,
            content_type,
            content_author,
            content_data,
            author,
            logs,
            ip_address
        })

        return await report.save().then(doc => {
            resolve(doc)
        }).catch(err => {
            reject(err)
        })
    })
};

module.exports.checkIfUserHasInterest = (interests, slug, want = false) => {
    console.log('interests', interests);
    return new Promise((resolve, reject) => {
        if (want === true) {
            if (interests.length === 0) {
                resolve(false);
            } else {
                interests.map((subject, i) => {
                    if (subject.slug == slug) {
                        resolve(subject);
                    }
                    if (i === (interests.length - 1)) {
                        reject()
                    }
                })
            }
        } else {
            if (interests.length === 0) {
                resolve(true);
            } else {
                let approve = true;
                let message = '';
                interests.forEach((subject, i) => {
                    console.log('subject', subject.slug)
                    if (subject.slug == slug) {
                        approve = false
                        message = 'User has interest.'
                    }
                })
                
                if (approve) {
                    resolve(true)
                } else {
                    reject(message)
                }
            }
        }
    })
};

module.exports.checkIfUserIsSubscribed = (subscriptions, id, want = false) => {


    return new Promise((resolve, reject) => {
        if (want === true) {
            if (subscriptions.length === 0) {
                reject(false);
            } else {
                subscriptions.map((subject, i) => {
                    if (subject._id == id) {
                        resolve(subject);
                        return
                    }
                    if (i === (subscriptions.length - 1)) {
                        reject()
                    }
                })
            }
        } else {
            if (subscriptions.length === 0) {
                resolve(true);
            } else {
                subscriptions.map((subject, i) => {
                    if (subject.id === id) {
                        console.log("ccccc",subject._id)

                        reject(true);
                        return
                    }
                    if (i === (subscriptions.length - 1)) {
                        console.log("dddddd",subject._id)

                        resolve(true);
                    }
                })
            }
        }
    })
};

module.exports.checkIfInterestExists = interest => {
    return new Promise(async (resolve, reject) => {
        let data = Interest.findOne({slug: interest})
        if (!data) {
            return reject(interest + ' is not a valid interest.')
        }

        return resolve(data)
    })
};

module.exports.validateInterestList = interests => {
    return new Promise(async (resolve, reject) => {
        let valid = true;
        if (!Array.isArray(interests)) {
            return reject('Interests must be an array')
        }

        interests.forEach(async interest => {
            let data = await Interest.findOne({ slug: interest })
            if (!data) {
                return reject(`"${interest}" is not a valid interest.`)
            }
        })

        return resolve(valid)
    })
};

module.exports.authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
            if (err) {
                console.error(err);
                return res.sendStatus(403);
            }

            const userData = await User.findOne({ _id: user.sub })
                
            req.userData = userData;
            req.user = user;
            next();
        })
    } else {
        console.log('No Authorization Header Provided.');
        res.sendStatus(401);
    }
};

module.exports.generateSixDigitCode = () => {
    let code = []

    for(let x = 0; x < 6; x++) {
        code.push(Math.floor(Math.random() * (9 - 0 + 1) + 0))
    }

    return code.join('')
}

module.exports.createPasscodeAction = (action, userID) => {
    return new Promise(async (resolve, reject) => {
        let user = await User.findOne({ _id: userID })
        
        user['passcode_actions'].push(action)
        let res = await user.save()
            .then(result => {
                return resolve(result)
            })
            .catch(err => reject)

        return res
    })
}

module.exports.doCodeAction = (code, userID, data) => {
    return new Promise(async (resolve, reject) => {
        let user = await User.findOne({ _id: userID })

        if (!user) {
            return reject("User not found")
        }

        // find the code
        let codeFound = false
        user['passcode_actions'].forEach(action => {
            if (action['passcode'] == code) {
                codeFound = action
            }
        })

        if (!codeFound) {
            return reject("Invalid code provided")
        }
        let email
        switch(codeFound['name']) {
            case 'changeEmail':
                email = codeFound['data']
                if (data !== email) {
                    console.log('data does not match email')
                    return reject("Invalid code provided")
                }
                user['email'] = email

                // Lets remove all passcodes for this
                user['passcode_actions'] = user['passcode_actions'].filter(action => {
                    if (action['name'] !== codeFound['name']) {
                        return action
                    }
                })
                
                await user.save().then(r => {
                    return resolve({success: true})
                }).catch(err => {
                    return reject(err)
                })
            break;
            case 'loginWithEmail':
                email = codeFound['data']
                if (data !== email) {
                    console.log('data does not match email')
                    return reject("Invalid code provided")
                }

                // Lets remove all passcodes for this
                user['passcode_actions'] = user['passcode_actions'].filter(action => {
                    if (action['name'] !== codeFound['name']) {
                        return action
                    }
                })
                
                await user.save().then(r => {
                    return resolve({success: true})
                }).catch(err => {
                    return reject(err)
                })
            break;
            default:
                return reject("Invalid action.")
        }
    })
}


module.exports.UserIdInList = async (user_id, list) => {
    let ret = false

    list.forEach(user => {

        if (user_id === user) {
            ret = true
        }
    })

    return ret
}

module.exports.toTimestamp = (strDate) => { 
    console.log('strDate', strDate)
    const dt = new Date(strDate).getTime();  
    return dt
    // dt / 1000; 
}