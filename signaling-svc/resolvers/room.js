const apollo = require('apollo-server-express');
const axios = require('axios');

const Room = require('../models/Room.model');
const User = require('../models/User.model');
const UserRef = require('../schemas/User.ref.schema.js');
const UserInputError = apollo.UserInputError;

const { withFilter } = require('graphql-subscriptions')
const { sendOneAlert, GetSocialCircle } = require('../helpers/alerts.helper')

const helpers = require('../helpers');
const UserIdInList = helpers.UserIdInList

const { syncLiveRoom, createLiveRoom, sendComment, removeComment, createReaction } = require('../helpers/room.firestore');
const { settingsToArray, getSettingsTemplate } = require('../helpers/room.helper');
const { me } = require('./user');

const authenticateJWT = helpers.authenticateJWT;
const checkIfUserIsSubscribed = helpers.checkIfUserIsSubscribed;

module.exports.participant = {
    id: parent => {
        console.log('parent', typeof parent)
        if (typeof parent === 'object') {
            parent = parent.id
        }
        return parent;
    },
    name: async (parent) => {
        if (typeof parent === 'object') {
            parent = parent.id
        }
        let author = await User.findOne({_id: parent})
        let returnName = '';
      
        if (author) {
            if (!author['is_alias']) {
                returnName = author['first_name']

                if (author['last_name'] && author['last_name'] !== '') {
                    returnName = `${author['first_name']} ${author['last_name']}`
                }
            } else {
                return author['alias']
            }
        } else {
            returnName = "Deleted User"
        }
        return returnName;
    },
    name_type: async (parent) => {
        if (typeof parent === 'object') {
            parent = parent.id
        }
        let author = await User.findOne({_id: parent})
        let returnName = 'anonymous'

        if (author && author['profile_complete'] && !author['anonymous']) {
            if (!author['anonymous']) {
                if (author['alias'] && author['alias'] !== '') {
                    returnName = 'alias'
                } else {
                    returnName = `full_name`
                }
            }
        }
        
        return returnName
    },
    profile_photo_url: async (parent) => {
        if (typeof parent === 'object') {
            parent = parent.id
        }
        let author = await User.findOne({_id: parent})
        
        if (author) {
            return author.profile_photo_url
        } else {
            return null;
        }
    },
    account_type: async (parent) => {
        let author = await User.findOne({ _id: parent })

        if (author) {
            if (author['is_alias']) {
                return 'alias';
            }
            
            if (author['is_bot']) {
                return 'bot';
            }

            return 'primary'
        } else {
            return 'deleted'
        }
    }
};

module.exports.schema = {
    id: (parent) => {
        //console.log('room parent', parent)
        return parent._id
    },
    live: async parent => {
        let isLive = false
        let theRoom = parent
        if (theRoom['broadcasters']) {
            if (theRoom['broadcasters'].length > 0) {
                isLive = true
            }
        }
        return isLive
    },
    hands_raised: (parent) => {
        let requests = []
        if (parent['line_up_requests']) {
            parent.line_up_requests.forEach(request => {
                request['participant'] = request['userID']
                requests.push(request)
            })
        }
        return requests
    }
}

module.exports.setting = {
    private: (parent) => {
        // console.log('private', parent)
        let private = false;
        parent.forEach(data => {
            let setting = data.split(':')
            let key = setting[0]
            let value = setting[1]

            if (key === 'private') {
                if (value === 'true') {
                    private = true
                }
            }
        })

        return private;
    },
    chat: (parent) => {
         console.log('chat', parent)
        let private = false;
        parent.forEach(data => {
            console.log('data', data)
            let setting = data.split(':')
            let key = setting[0]
            let value = setting[1]

            if (key === 'chat') {
                if (value === 'true') {
                    private = true
                }
            }
        })

        return private;
    },
    video: (parent) => {
        // console.log('video', parent)
        let private = false;
        parent.forEach(data => {
            let setting = data.split(':')
            let key = setting[0]
            let value = setting[1]

            if (key === 'video') {
                if (value === 'true') {
                    private = true
                }
            }
        })

        return private;
    },
    audio: (parent) => {
        // console.log('audio', parent)
        let private = false;
        parent.forEach(data => {
            let setting = data.split(':')
            let key = setting[0]
            let value = setting[1]

            if (key === 'audio') {
                if (value === 'true') {
                    private = true
                }
            }
        })

        return private;
    },
    public: parent => {
         // console.log('audio', parent)
         let private = false;
         parent.forEach(data => {
             let setting = data.split(':')
             let key = setting[0]
             let value = setting[1]
 
             if (key === 'public') {
                 if (value === 'true') {
                     private = true
                 }
             }
         })
 
         return private;
    },
    network_only: parent => {
         // console.log('audio', parent)
         let private = false;
         parent.forEach(data => {
             let setting = data.split(':')
             let key = setting[0]
             let value = setting[1]
 
             if (key === 'network_only') {
                 if (value === 'true') {
                     private = true
                 }
             }
         })
 
         return private;
    },
    invite_only: parent => {
        // console.log('audio', parent)
        let private = false;
        parent.forEach(data => {
            let setting = data.split(':')
            let key = setting[0]
            let value = setting[1]

            if (key === 'invite_only') {
                if (value === 'true') {
                    private = true
                }
            }
        })

        return private;
    }
}

const broadcastNextInLine = (roomID, pubsub) => {
    return new Promise(async (resolve, reject) => {
        let room = await Room.findOne({ _id: roomID })
        if (!room) {
            reject('Room does not exist.')
        }

        let userId = room['line_up'][0]

        if (room.line_up.length < 1) {
            reject('No other people in lineup.')
        }

        room.broadcasters.push(room['line_up'][0])

        // Now remove that user from the lineup
        let tmp_lineup = []
        room.broadcasters.forEach(u => {
            if (u !== userId) {
                tmp_lineup.push(u)
            }
        })
        room['line_up'] = tmp_lineup

        let participant = await User.findOne({ _id: userId })
        if (!participant) {
            reject('Participant does not exist')
        }

        await room.save()
            .then(() => {
                pubsub.publish('USER_STARTED_BROADCAST', {
                    RoomUpdated: {
                        room,
                        participant,
                        event: 'USER_STARTED_BROADCAST'
                    },
                    RoomListUpdates: {
                        event: 'ROOM_UPDATED',
                        participant: null,
                        room
                    }
                })
            })
            .catch(err => {
                reject(err)
            })
        resolve(true)
    })
}

module.exports.actions = async (parent, { roomID, participant, method}, { user }) => {
    let _room, _user, _ismod = false, _obj = {}, _isban;
    switch (method) {
        case "demote":
            if (user.sub && roomID && participant) {
                _room = await Room.findOne({ _id: roomID, author: user.sub})
                    .then((result) => {
                        return result;
                    })
                    .catch((err) => {
                        console.error(err);
                        return false;
                    })
                if(!_room) {
                    return new UserInputError(`Room '${roomID}' not found or user is not authorized to demote`);
                } else {
                    _user = await User.findOne({ _id: participant })
                        .then((result) => {
                            return result;
                        })
                        .catch((err) => {
                            console.error(err);
                            return false;
                        })
                    if(!_user) {
                        return new UserInputError(`User '${participant}' not found`);
                    } else {
                        _room.moderators.forEach(function(_users, i) {
                            if(_users == participant) {
                                _ismod = true;
                                _room.moderators.splice(i, 1); 
                            }
                        });
                        if(_ismod) {
                            _obj['moderators'] =  _room.moderators
                            const saved = await Room.updateOne({ _id: roomID}, _obj)
                            .then((s) => {
                                console.log('User has been demoted', s);
                                return { success: true };
                            })
                            .catch((err) => {
                                console.log('error', err);
                                return new UserInputError('Could not demote user');
                            });
                            return saved;
                        } else {
                            return new UserInputError(`User '${participant}' is not a moderator`);
                        }
                    }
                }
            } else {
                return new UserInputError(`Missing userID, participant, or roomID`);
            }            
        break;
        case "promote":
            if (user.sub && roomID && participant) {
                _room = await Room.findOne({ _id: roomID, author: user.sub})
                    .then((result) => {
                        return result;
                    })
                    .catch((err) => {
                        console.error(err);
                        return false;
                    })
                if(!_room) {
                    return new UserInputError(`Room '${roomID}' not found or user is not authorized to promote`);
                } else {
                    _user = await User.findOne({ _id: participant })
                        .then((result) => {
                            return result;
                        })
                        .catch((err) => {
                            console.error(err);
                            return false;
                        })
                    if(!_user) {
                        return new UserInputError(`User '${participant}' not found`);
                    } else {
                        _room.blacklist.forEach(function(_users) {
                            if(_users == participant) {
                                _isban = true;
                            }
                        });
                        if(_isban) {
                            return new UserInputError(`User '${participant}' cannot be promoted, because they are banned`);
                        }
                        _room.moderators.forEach(function(_users) {
                            if(_users == participant) {
                                _ismod = true;
                            }
                        });
                        if(_ismod) {
                            return new UserInputError(`User '${participant}' already a moderator`);
                        } else {
                            _room.moderators.push(participant)
                            _obj['moderators'] =  _room.moderators
                            const saved = await Room.updateOne({ _id: roomID}, _obj)
                                .then((s) => {
                                    console.log(`User '${participant}' promoted to moderator`, s);
                                    return { success: true };
                                })
                                .catch((err) => {
                                    console.log('error', err);
                                    return new UserInputError('Could not promote user');
                                });
                            return saved;
                        }
                    }
                }
            } else {
                return new UserInputError('Missing userID, participant, or roomID');
            }
        break;
        case "ban":
            if (user.sub && roomID && participant) {
                _room = await Room.findOne({
                    "$or": [{
                        _id: roomID, author: user.sub
                    }, {
                        _id: roomID, moderators: user.sub
                    }]})
                        .then((result) => {
                            return result;
                        })
                        .catch((err) => {
                            console.error(err);
                            return false;
                        })
                if(!_room) {
                    return new UserInputError(`Room '${roomID}' not found or user is not authorized to promote`);
                } else {
                    if(participant == user.sub) {
                        return new UserInputError(`You cannot ban yourself`);
                    } else {
                        if(participant == _room.author) {
                            return new UserInputError(`You cannot ban the author`);
                        } else {
                            _room.moderators.forEach(function(_users) {
                                if(_users == participant) {
                                    _ismod = true;
                                }
                            });
                            if(_ismod) {
                                return new UserInputError(`User '${participant}' is a moderator and must be demoted before being banned`);
                            } else {
                                if(_room.blacklist) {
                                    _room.blacklist.forEach(function(_users) {
                                        if(_users == participant) {
                                            _isban = true;
                                        }
                                    });
                                } else {
                                    _room.blacklist = []
                                }
                                if(_isban) {
                                    return new UserInputError(`User '${participant}' is already banned`);
                                } else {
                                    _room.blacklist.push(participant)
                                    _obj['blacklist'] =  _room.blacklist
                                    const saved = await Room.updateOne({ _id: roomID}, _obj)
                                        .then((s) => {
                                            console.log(`User '${participant}' has been banned`, s);
                                            return { success: true };
                                        })
                                        .catch((err) => {
                                            console.log('error', err);
                                            return new UserInputError(`Could not '${participant}' be banned`);
                                        });
                                    return saved;
                                }
                            }
                        }
                    }
                }
            } else {
                return new UserInputError('Missing userID, participant, or roomID');
            }
        break;
        case "unban":
            if (user.sub && roomID && participant) {
                _room = await Room.findOne({
                    "$or": [{
                        _id: roomID, author: user.sub
                    }, {
                        _id: roomID, moderators: user.sub
                    }]})
                    .then((result) => {
                        return result;
                    })
                    .catch((err) => {
                        console.error(err);
                        return false;
                    })
                if(!_room) {
                    return new UserInputError(`Room '${roomID}' not found or user is not authorized to promote`);
                } else {
                    if(_room.blacklist) {
                        _room.blacklist.forEach(function(_users, i) {
                            if(_users == participant) {
                                _isban = true;
                                _room.blacklist.splice(i, 1); 
                            }
                        });
                    } else {
                        _room.blacklist = []
                    }
                    if(!_isban) {
                        return new UserInputError(`User '${participant}' is not banned`);
                    } else {
                        _obj['blacklist'] =  _room.blacklist
                        const saved = await Room.updateOne({ _id: roomID}, _obj)
                            .then((s) => {
                                console.log(`User '${participant}' has been banned`, s);
                                return { success: true };
                            })
                            .catch((err) => {
                                console.log('error', err);
                                return new UserInputError(`Could not '${participant}' be banned`);
                            });
                        return saved;
                    }
                }
            } else {
                return new UserInputError('Missing userID, participant, or roomID');
            }
        break;
        default: 
            return new UserInputError('Method not found');
        break;
    }
}

module.exports.disable = async ( parent, { id }, { user, indices }) => {
    // Close the room
    const { rooms } = indices
    if (!user.sub) {
        return new UserInputError('Not authenticated.')
    }

    let room = await Room.findOne({ _id: id, author: user.sub })
    if (!room) {
        return new UserInputError('Room does not exist.')
    }

    if (room['disabled']) {
        return new UserInputError('Room already disabled.')
    }

    room['disabled'] = true;

    // lets remove participants and other data
    room['participants'] = []
    room['broadcasters'] = []
    room['schedule'] = {}

    let saved = room.save()
        .then(async saveData => {
            let saveIndex = await rooms.saveObject({
                objectID: id,
                ...saveData._doc
            }).catch(err => {
                console.log('indexing err', err)
                throw new UserInputError('Issue updating room Index.')
            })
        })
        .catch(err => {
            console.log('error disabling room', err)
            throw new UserInputError('Issue saving room. Could not disable.')
        })
    
    return {
        success: true
    }
}

module.exports.create = async (parent, { 
        title, 
        interests,
        description, 
        template 
}, { user, indices }) => {
    // Lets get info about the user
    let author = await User.findOne({ _id: user.sub })
    let { rooms } = indices

    if (!author) {
        throw new UserInputError("Not authenticated.")
    }

    template = (!template ? 'default' : template)

    let settingsResult = getSettingsTemplate(template, { description })
    
    if (!settingsResult.success) {
        throw new UserInputError(settingsResult.error)
    }

    let { 
        templateSettings, 
        config
    } = settingsResult
    
    description = config['description']
    
    title = (!title) ? `${author['first_name']}` : title
    interests = (!interests) ? [] : interests

    // Make sure all interests are valid
    let interestsValid = await helpers.validateInterestList(interests)
        .catch((err) => {
            throw new UserInputError(err)
        })
    
    // Convert settings object to database compatible array
    const userSettings = settingsToArray(templateSettings)
    console.log('userSettings', userSettings)
    let participants = []
    participants.push(user.sub)

    let data = {
        title,
        author: user.sub,
        settings: userSettings,
        participants,
        interests,
        description,
        template
    }

    console.log('roomData', data);
    let room = new Room(data)

    let roomData = await room.save()
        .then(async (saveData) => {
           let saveIndex = await rooms.saveObject({
               objectID: saveData.id,
               settings: templateSettings,
               ...saveData._doc
           })
           await createLiveRoom(saveData['_id']).then( async res => {
                await syncLiveRoom(saveData._id).then(result => {
                    //console.log('liveRoom sync result', result)
                }).catch(err => {
                    console.log('liveRoom sync err', err)
                })
            })

           if (template == 'social') {
               let { socialCircle } = await GetSocialCircle(author)
               if (socialCircle.length > 0) {
                    socialCircle.forEach(async recipient => {
                        let users = []
                        users.push(author.id)
                        let sent = await sendOneAlert(recipient, {
                            title: `New Room`,
                            message: `${author['is_alias'] ? author['alias'] : `${author['first_name']} ${author['last_name']}`} created a social room: ${title}`,
                            type: `newRoom`,
                            link: `room:${saveData.id}`,
                            link_type: 'newRoom',
                            read: false,
                            users
                        })
                    })
                }
            }
            return saveData;
        })
        .catch((err) => {
            console.log('error inserting new room', err);
            return new UserInputError(err);
        })
    return roomData;
}

module.exports.update = async ( parent, attr, { user, indices, pubsub }) => {
    const {
        id,
        title,
        interests,
        private,
        audio,
        video,
        chat,
        network_only,
        invite_only,
        description
    } = attr;

    let room = await Room.findOne({ _id: id, author: user.sub });
    const { rooms } = indices

    if(!room) {
        throw new UserInputError("Room does not exist or invalid permissions. Only the Author can update room settings");
    } 


    const updatedSettings = () => {
        // current settings
        let settings = room['settings'];

        return new Promise((resolve, reject) => {      
            let newSettings = []
            // Defaults
            let defaults = {
                private: false,
                chat: true,
                video: true,
                audio: true,
                public: true,
                invite_only: false,
                network_only: false
            };
            
            // Overwrite Defaults with current room data
            settings.forEach( setting => {
                let pair = setting.split(':')
                let key = pair[0]
                let value = pair[1]
                defaults[key] = value;
            })

            // Generate new settings array
            Object.keys(defaults).forEach( setting => {
                console.log('setting', setting)
                
                // Is this setting set? (we are working with booleans so we need more than a conditional)
                let isset = false;
                Object.keys(attr).forEach(param => {
                    if (param === setting) {
                        isset = true
                    }
                })

                if (isset) {
                    console.log('attr[setting]', attr[setting])
                    // these are updated
                    newSettings.push(`${setting}:${attr[setting]}`)
                } else {
                    console.log('defaults[setting]', defaults[setting])
                    newSettings.push(`${setting}:${defaults[setting]}`)
                }
            })
            resolve(newSettings)
        })
    };

    const userSettings = await updatedSettings()
        .then((data) => {
            return data;
        })
        .catch(err => {
            throw new UserInputError(err)
        }) 

    // Lets create the newData
    const newData = {}, allowed = [
        'title',
        'interests',
        'description'
    ];
    // Make sure all interests are valid
    var interest = (!interests) ? [] : interests
    let interestsValid = await helpers.validateInterestList(interest)
        .catch((err) => {
            throw new UserInputError(err)
        })

    allowed.forEach( val => {
        if(attr[val]) {
            newData[val] = attr[val];
        }
    });

    // Always attach settings
    console.log('userSettings', newData)
    newData['settings'] = userSettings;
    
    return Room.findOneAndUpdate({ 
            _id: id, author: user.sub
        }, 
        newData, 
        {
            upsert: false,
            useFindAndModify: false
        }, 
        async (err, doc) => {
            if (err) {
                throw new UserInputError("Error updating post data");
            }
            await rooms.saveObject({
                objectID: doc._id,
                ...doc._doc
            }, {
                autoGenerateObjectIDIfNotExist: false
            })

            pubsub.publish('ROOM_UPDATED', {
                RoomUpdated: {
                    event: 'ROOM_UPDATED',
                    participant: null,
                    room: doc._doc
                },
                RoomListUpdates: {
                    event: 'ROOM_UPDATED',
                    participant: null,
                    room: doc._doc
                }
            })
            return doc;
        }
    )
}

module.exports.delete = async ( parent, { id }, { user, indices }) => {
    // get the room data
    const { rooms } = indices;

    let status = await Room.findOneAndDelete(
            { 
                _id: id, author: user.sub
            }
        )
        .then(async (status) => {
            await rooms.deleteObject(id)
            await syncLiveRoom(id).then((result) => {
                //console.log('liveRoom sync result', result)
            }).catch(err => {
                console.log('liveRoom sync err', err)
            })
            
            return { success: true }
        })
        .catch(err => {
                console.log('error', err)
                return new UserInputError("Error deleting room");
        })
    
    return status
}

module.exports.broadcast = async(parent, args, { user, pubsub }) => {
    const broadcaster = await User.findOne({ _id: user.sub })

    const { id } = args
    let event_name

    const room = await Room.findOne({ _id: id })
    let isAllowed = false

    // This user must be a participant
    console.log( 'participants', room['participants'] )

    room['participants'].forEach((participant) => {
        if (participant == user.sub) {
            // make sure user isn't already a broadcaster
            room['broadcasters'].forEach(caster => {
                if (caster == user.sub) {
                    throw new UserInputError('Already broadcasting')
                }
            })

            room['line_up'].forEach(caster => {
                if (caster == user.sub) {
                    throw new UserInputError('Already in Line Up')
                }
            })
        }
    })

     // make sure user is a listener
     room['listening'].forEach(l => {
        if (l == user.sub) {
            isAllowed = true
        }
    })

    if (isAllowed) {
       // room.broadcasters.push(user.sub);
       // Lets s
        /* room.broadcasters.push({
            status: false,
            id: user.sub, 
        });
        */
        // reset isAllowed for this next operation
        isAllowed = false
        let requestExists = false

        if (room.author == user.sub) {
            isAllowed = true
        } else {
            // Is there a lineup request from this user
            room.line_up_requests.forEach(request => {
                if (request.userID == user.sub) {
                    requestExists = true
                    if (!request.approved) {
                        throw new UserInputError('You already raised your hand.') 
                    } else {
                        isAllowed = true
                    }
                }
            })

            if (!requestExists) {
                // Then create new request
                room.line_up_requests.push({
                    userID: user.sub
                })
                event_name = 'USER_RAISED_HAND'
            }
        }

        if (isAllowed) {
            let authorIsBroadcasting = false
            let limit = 5
            room.broadcasters.forEach(b => {
                if (b == room.author) {
                    authorIsBroadcasting = true
                }
            })
            
            if (authorIsBroadcasting) {
                limit = 6
            }
           
            if (user.sub == room.author) {
                event_name = 'USER_STARTED_BROADCAST'
                room.broadcasters.push(user.sub)
            } else {
                if (room.broadcasters.length < limit) {
                    event_name = 'USER_STARTED_BROADCAST'
                    room.broadcasters.push(user.sub)
                } else {
                    event_name = 'USER_JOINED_LINEUP'
                    room.line_up.push(user.sub)   
                }
            }
            let new_listening = []
            room['listening'].forEach((p, i) => {
                if (p !== user.sub) {
                    //remove room['listening'][i]
                    new_listening.push(p)
                }
            })
            room['listening'] = new_listening
        }
        

        const saved = await Room.updateOne({ _id: id}, room)
            .then(async s => {
                // Publish to apollo graphql subscriptions
            
                // console.log(`${user.sub} has joined room`, s);
                if (event_name == 'USER_RAISED_HAND') {
                    let users = []
                    users.push(broadcaster.id)
                    let sendRequestAlert = await sendOneAlert(room['author'], {
                        type: 'broadcastRequest',
                        title: `New Broadcast Request`,
                        subtext: null,
                        link: `room:${room.id}`,
                        link_type: 'request',
                        read: false,
                        message: `${(broadcaster['is_alias'] ? broadcaster['alias'] : `${broadcaster['first_name']} ${broadcaster['last_name']}`)} raised their hand in ${room['title']}.`,
                        buttons: [
                            {
                                label: "Approve",
                                type: "approveRequest",
                                link: `room:${room.id};${broadcaster.id}`
                            },
                            {
                                label: "Reject",
                                type: "rejectRequest",
                                link: `room:${room.id};${broadcaster.id}`
                            }
                        ],
                        users
                        
                    }).catch((err) => {
                        console.log('error sending alert', err)
                    })

                    console.log('sendRequestAlert', sendRequestAlert)
                }

                pubsub.publish(event_name, {
                    RoomUpdated: {
                        event: event_name,
                        participant: broadcaster,
                        room
                    },
                    RoomListUpdates: {
                        event: 'ROOM_UPDATED',
                        participant: null,
                        room
                    }
                })
                

                return { success: true };
            })
            .catch((err) => {
                console.log('error', err);
                return new UserInputError(err);
            });

        return saved;
    } else {
        return new UserInputError('Must be a participant.')
    }
}

module.exports.manageBroadcastRequest = async (parent, args, { user, pubsub }) => {
    // Make sure user is moderator or author
    let isAllowed = false

    // Lets get the user
    let me = await User.findOne({ _id: user.sub })
    if (!me) {
        return new UserInputError('Not authenticated')
    }

    // Let's get the room args
    const {
        roomID,
        userID,
        approve
    } = args

    // Now lets get the room
    const room = await Room.findOne({ _id: roomID })
    if (!room) {
        return new UserInputError('That room does not exist.')
    }

    // Now lets make sure we are authorized to make this request
    room['moderators'].forEach(m => {
        console.log('m', m)
        if (m == me.id) {
            isAllowed = true
        }
    })

    if (room['author'] == me.id) {
        isAllowed = true
    }

    if (!isAllowed) {
        return new UserInputError('You are not authorized to perform this action.')
    }

    // The user who will be promoted to broadcaster
    let participant = await User.findOne({ _id: userID })
    if (!participant) {
        return new UserInputError('That user no longer exists somehow.')
    }

    // Lets reset the isAllowed now
    isAllowed = false

    // Lets make sure this user is a participant
    room['participants'].forEach(p => {
        if (p == participant.id) {
            isAllowed = true
        }
    })

    room['invitees'].forEach(p => {
        if (p == participant.id) {
            isAllowed = true
        }
    })

    if (!isAllowed) {
        return new UserInputError('The user must be a participant or invitee.')
    }

    // Now lets make sure there is a request for this user
    isAllowed = false

    room['line_up_requests'].forEach((r, i) => {
        if (r.userID == participant.id) {
            if (!r.approved) {
                isAllowed = true
                room['line_up_requests'][i].answered = true
                room['line_up_requests'][i].approved = true
                pubsub.publish('LINEUP_REQUEST_ACCEPTED', {
                    RoomUpdated: {
                        event: 'LINEUP_REQUEST_ACCEPTED',
                        participant,
                        room
                    }
                })
            }
        }
    })

    if (!isAllowed) {
        return new UserInputError('There are no speaker requests from this user.')
    }

    let saved = await room.save()
        .catch(err => {
            throw new UserInputError(err)
        })

    if (saved) {
        return { success: true }
    }
}

const old_manageBroadcastRequest = async(parent, args, { user, pubsub }) => {
    const broadcaster = await User.findOne({ _id: user.sub })
    const { roomID,userID,approve} = args
    const subscribee = await User.findOne({ _id: userID })

    const room = await Room.findOne({ _id: roomID })

    // This user must be a participant
    let braodcaster;
    room['broadcasters'].forEach(caster => {
        
        if (caster["id"] === userID) {
            room['broadcasters']
            caster["status"] = approve
            braodcaster = caster;
        }else{
            throw new UserInputError('This user is not existing broadcasting')
        }

    })

    console.log('broadcasters',  room['broadcasters']);
   
    const saved = await Room.updateOne({ _id: roomID}, room)
    .then(async s => {
        subscribee.followers.push({
            user_id: userID
        })
        let sent = await sendOneAlert(subscribee, {
            title: `${subscribee['alias']} is approved.`,
            message: "${subscribee['",
            type: "approve",
            link: "followers"
        })
        return { success: true };
    })
    .catch((err) => {
        console.log('error', err);
        return new UserInputError(err);
    });

    return saved;             
}

module.exports.inviteUserRoom = async(parent, args, { user, pubsub }) => {
    const broadcaster = await User.findOne({ _id: user.sub })
    

    const { roomID,userID} = args
    const subscribee = await User.findOne({ _id: userID })

    const room = await Room.findOne({ _id: roomID })

    let isAllowed = true;
    let err_msg = '';

    if (!room) {
        return new UserInputError("Room does not exist. It may have been deleted!")
    }
    if (room['blacklist']) {
        if(await UserIdInList(userID, room['blacklist'])) {
            isAllowed = false
            err_msg = 'banned';
        }
    }

    if (room['participants']) {

        if (await UserIdInList(userID, room['participants'])) {
            isAllowed = false
            err_msg = 'already joined'
        }
    } 

    if (isAllowed) {
        room['participants'].push(userID)
        const saved = await Room.updateOne({ _id: roomID}, room)
            .then(async (s) => {
                console.log(`${user.sub} has invited room`, userID);
                subscribee.followers.push({
                    user_id: userID
                })
                await sendOneAlert(subscribee, {
                    title: `${subscribee['first_name']} + " " + ${subscribee['last_name']} is invited Room.`,
                    message: "tap to view",
                    type: "invited",
                    link: "https://link.icered.com/followers"
                })
                return { success: true };
            })
            .catch((err) => {
                console.log('error', err);
                //return new UserInputError(err);
            });   

            return { success: true };  
     

    } else {
        return new UserInputError(err_msg);
    }           

}

module.exports.inviteUserRoomMulti = async(parent, args, { user, pubsub }) => {
    const moderator = await User.findOne({ _id: user.sub })
    const { 
        roomID,
        userIDs,
        invite_as
    } = args
    var count = 0
    let err_msg = ''

    const room = await Room.findOne({ _id: roomID })
    if (!room) {
        return new UserInputError("Room does not exist. It may have been deleted!")
    }

    let can_invite = false
    let is_moderator = false

    if (room['template'] == 'open') {
        can_invite = true
    } else {
        if (room['author'] == moderator.id) {
            can_invite = true
            is_moderator = true
        } else {
            room['moderators'].forEach(moderator => {
                if (moderator == moderator.id) {
                    can_invite = true
                    is_moderator = true
                }
            })
        }
    }
    
    if (!can_invite) {
        return new UserInputError("You are not allowed to invite users to this room.")
    }

    let results =  await Promise.all(userIDs.map(async(userID) => {
        const subscribee = await User.findOne({ _id: userID })
        let isAllowed = true
       
        if (room['blacklist']) {
            if(await  UserIdInList(userID, room['blacklist'])) {                
                isAllowed = false
                err_msg = 'banned';
                console.log(userID,room['blacklist'])
            }
        }

        if (room['participants']) {
            if (await UserIdInList(userID, room['participants'])) {
                isAllowed = false
                err_msg = 'already joined'
                console.log(userID,room['participants'])
            }
        } 

        console.log(userID,isAllowed)

        if (isAllowed) {
            room['invitees'].push(userID)
            if (is_moderator) {
                room['line_up_requests'] = room['line_up_requests'] ? room['line_up_requests'] : []
                room['line_up_requests'].push({
                    userID: userID,
                    approved: true,
                    answered: true
                })
            }

            const saved = await Room.updateOne({ _id: roomID}, room)
                .then(async (s) => {
                    console.log(`${user.sub} has been invited to room`, userID);
                    let subscribee_name = !subscribee['is_alias'] ? `${subscribee['first_name']} ${subscribee['last_name']}` : subscribee['alias']
                    let moderator_name = !moderator['is_alias'] ? `${moderator['first_name']} ${moderator['last_name']}` : moderator['alias']
                    let users = []
                    users.push(moderator.id)
                    let works = await sendOneAlert(userID, {
                        title: "Room Invite",
                        message: `${moderator_name} invited you to join "${room.title}"`,
                        subtext: null,
                        type: "roomInvitation",
                        link: `room:${roomID}`,
                        users
                    })
                    return { success: true };
                })
                .catch((err) => {
                    console.log('error', err);
                    //return new UserInputError(err);
                });   
                count++;
                return { success: true };          

        } else {
            return new UserInputError(err_msg);
        }           
    }));
    return {success: true} 

}

module.exports.stopBroadcasting = async(parent, args, { user, pubsub }) => {
    const participant = await User.findOne({ _id: user.sub })
    const { id } = args;

    const room = await Room.findOne({ _id: id })
    let broadcasters = room.broadcasters

    if (broadcasters) {
        let tmp_broadcasters = []
        room['broadcasters'].forEach((p, i) => {
            if (p !== user.sub && p !== null) {
                tmp_broadcasters.push(p)
                // room['broadcasters'].splice(i, 1)
            } else {
                console.log('broadcaster', p)
            }
        })
        room['broadcasters'] = tmp_broadcasters
        console.log('room broadcasters', room['broadcasters'])

        room['listening'].push(user.sub)

        const saved = await Room.updateOne({ _id: id }, room)
            .then(async s => {
                pubsub.publish('USER_ENDED_BROADCAST', {
                    RoomUpdated: {
                        event: 'USER_ENDED_BROADCAST',
                        participant,
                        room
                    },
                    RoomListUpdates: {
                        event: 'ROOM_UPDATED',
                        participant: null,
                        room
                    }
                })
                let cycled = await broadcastNextInLine(room.id)
                    .catch(err => {
                        console.log('trouble broadcasting next in line')
                        console.error(err)
                    })
                return { success: true };
            })
            .catch(err => {
                console.log('error', err);
                return new UserInputError(err);
            });

        return saved
    }
}

module.exports.listBroadcastRequests = async ( parent, { roomID }, { user, pubsub }) => {
    // Make sure user is moderator or author
    let isAllowed = false

    // Lets get the user
    let me = await User.findOne({ _id: user.sub })
    if (!me) {
        return new UserInputError('Not authenticated')
    }

    // Now lets get the room
    const room = await Room.findOne({ _id: roomID })
    if (!room) {
        return new UserInputError('That room does not exist.')
    }

    // Now lets make sure we are authorized to make this request
    room['moderators'].forEach(m => {
        console.log('m', m)
        if (m == me.id) {
            isAllowed = true
        }
    })

    if (room['author'] == me.id) {
        isAllowed = true
    }

    if (!isAllowed) {
        return new UserInputError('You are not authorized to perform this action.')
    }
    
    room.line_up_requests.forEach((r, i) => {
        room.line_up_requests[i]['participant'] = r.userID 
    })

    return room.line_up_requests
}

module.exports.leaveBroadcastQueue = async (parent, args, { user, pubsub }) => {
    const me = await User.findOne({ _id: user.sub })
    const { roomID } = args
    if (!me) {
        return new UserInputError('Not authenticated')
    }

    const room = await Room.findOne({ _id: roomID })
    if (!room) {
        return new UserInputError('Room does not exist')
    }

    // Lets make sure to just remove us from broadcasting queue if we are in it
    let in_queue = false
    let new_lineup = []
    room['line_up'].forEach((p, i) => {
        if (p == user.sub) {
            in_queue = true
            //room['line_up'].splice(i, 1)
        } else if (p !== user.sub && p) {
            new_lineup.push(p)
        }
    })
    room['line_up'] = new_lineup

    if (in_queue) {
        let in_listening = false
        room['listening'].forEach(l => {
            if (l == user.sub) {
                in_listening = true
            }
        })

        if (!in_listening) {
            room['listening'].push(user.sub)
            let saved = await room.save()
                .catch(err => {
                    throw new UserInputError(err)
                })
            return { success: true }
        }
    } else {
        return new UserInputError('You are not in the broadcast queue.')
    }
}

module.exports.join = async(parent, args, { user, pubsub }) => {
    // Joining a room will add the user as a participant and return some necessary data to the client.
    const participant = await User.findOne({ _id: user.sub })
    
    const { id } = args;

    const room = await Room.findOne({ _id: id })
    let isAllowed = true;
    let err_msg = '';

    if (!room) {
        return new UserInputError("Room does not exist. It may have been deleted!")
    }
    if (room['blacklist']) {
        room['blacklist'].forEach((p) => {
            if (p == user.sub) {
                isAllowed = false;
                err_msg = 'banned';
            }
        })
    }

    if (room['participants']) {
        room['participants'].forEach(p => {
            if (p == user.sub) {
                isAllowed = false;
                err_msg = 'already joined';
            }
        })
    } else {
       room['participants'] = [] 
    }

    let disAllow = false
    if (room['template']) {
        switch(room['template']) {
            case 'closed':
                //  must finish this
            break;
        }
    }

    if (disAllow) {
        isAllowed = false
    }

    if (isAllowed) {
        room['participants'].push(user.sub)

        // Start them out as a listener
        let pushListener = true
        room['listening'].forEach(listenr => {
            if (listenr == user.sub) {
                pushListener = false
            }
        })

        if (pushListener) room['listening'].push(user.sub)

        console.log('new room after join', room)
        const saved = await room.save()
            .catch((err) => {
                console.log('error', err);
                //return new UserInputError(err);
            });
            
        console.log(`${user.sub} has joined room: ${room.title}`);
        pubsub.publish('USER_JOINED_ROOM', {
            RoomUpdated: {
                event: 'USER_JOINED_ROOM',
                participant,
                room
            },
            RoomListUpdates: {
                event: 'ROOM_UPDATED',
                participant: null,
                room
            }
        })

        await syncLiveRoom(id).catch(err => {
            console.log('liveRoom sync err', err)
        })
            
        //return saved;
        //let room = await Room.findOne({ _id: id })
        if (room) {
            // Then lets add this interest to the user
             //console.log('interest=============', user);
            let isSubscribed = await checkIfUserIsSubscribed(participant.subscriptions, room._id, false)
                .catch((ri) => {
                    console.log('User already subscribed.', ri)
                    return true
                    //return new UserInputError('Already subscribed to '+room['title']);
                })
            
            console.log('isSubscribed', isSubscribed)
            if (!isSubscribed) {
                participant.subscriptions.push({
                    type: 'room',
                    id: room._id,
                    payload: {
                        user_id: user.sub
                    }
                });
            
                await participant.save()
                    .catch((err) => {
                        console.error(err);
                        return new UserInputError(err);
                    })
                // console.log('interest saved');
                // Add this subscriber to the interest
                room.subscribers.push( { user_id: participant._id });
                
                await room.save()                           
                    .catch((err) => {
                        console.log('error', err);
                        return new UserInputError('Could not add user to room subscribers');
                    })
            }
            // console.log('user now subscribed to room', param);
            return { success: true }
        }
    } else {
        return new UserInputError(err_msg);
    }
}

module.exports.leave = async(parent, args, { user, pubsub }) => {
    // Joining a room will add the user as a participant and return some necessary data to the client.
    const participant = await User.findOne({ _id: user.sub })
    const { id } = args;

    const room = await Room.findOne({ _id: id })
    if (!room) {
        return new UserInputError("That room does not exist.")
    }

    // Are we the author of the room? Because if we are, we are gonna delete the room
    if (participant.id == room.author) {
        console.log('delete the room')
        let deleted = await Room.deleteOne({ _id: id })

        if (deleted) {
            pubsub.publish('ROOM_DELETED', {
                RoomUpdated: {
                    event: 'ROOM_DELETED',
                    participant,
                    room
                },
                RoomListUpdates: {
                    event: 'ROOM_DELETED',
                    participant: null,
                    room
                }
            })
            let updated = await syncLiveRoom(id)
                .catch((err) => {
                    console.log('err', err)
                })
            console.log('room updated', updated)
            return { success: true }
        } else {
            return { success: false }
        }
    }

    let participants = room.participants;
    let isAllowed = false;
    let err_msg = 'empty room';

    if (participants) {
        let was_broadcaster = false
        let new_participants = []
        room['participants'].forEach((p, i) => {
            if (p) {
                if (p == user.sub) {
                    isAllowed = true;
                    // room['participants'].splice(i, 1);
                } else {
                    new_participants.push(p)
                }
            }
        })
        room['participants'] = new_participants

        let tmp_broadcasters = []
        room['broadcasters'].forEach((p, i) => {
            if (p) {
                if (p !== user.sub) {
                    tmp_broadcasters.push(p)
                    console.log('p', p)
                    //room['broadcasters'].splice(i, 1)
                } else {
                    was_broadcaster = true
                }
            }
        })
        room['broadcasters'] = tmp_broadcasters

        let new_listening = []
        room['listening'] = (!room['listening'] ? [] : room.listening)
        room['listening'].forEach((p, i) => {
            if (p) {
                if (p !== user.sub) {
                    new_listening.push(p)
                }
            }
        })

        room['listening'] = new_listening

        let new_lineup = []
        room['line_up'].forEach((p, i) => {
            if (p !== user.sub && p) {
                new_lineup.push(p)
            }
        })
        room['line_up'] = new_lineup
     
        if (isAllowed) {
            const saved = await Room.updateOne({ _id: id}, room)
                .then(async s => {
                    console.log(`${user.sub} has left room`, room.id);

                    pubsub.publish('USER_LEFT_ROOM', {
                        RoomUpdated: {
                            event: 'USER_LEFT_ROOM',
                            participant,
                            room
                        },
                        RoomListUpdates: {
                            event: 'ROOM_UPDATED',
                            participant: null,
                            room
                        }
                    })

                    if (was_broadcaster) {
                        // That user left, lets cycle to the next user in the queue
                        let cycled = await broadcastNextInLine(room.id)
                            .catch(err => {
                                console.log('trouble broadcasting next in line')
                                console.error(err)
                            })
                    }
                    return { success: true };
                })
                .catch((err) => {
                    console.log('error', err);
                    return new UserInputError(err);
                });
            return saved;
        } else {
            err_msg = 'user not in room';
            return new UserInputError(err_msg);
        }
    } else {
        return new UserInputError(err_msg);
    }
}

module.exports.subscribe = async(parent, { id }, { user }) => {
    // Add a user to a room
   let loggedIn = await User.findOne({ _id: user.sub })
    
    if (loggedIn) {
        let room = await Room.findOne({ _id: id })
        
        if (room) {
            // Then lets add this interest to the user
             //console.log('interest=============', user);
            const output = await User.findOne( { _id: user.sub })
                .then( async (subscriber) => {
                    
                   
                    const checkValid = await checkIfUserIsSubscribed(subscriber.subscriptions, id, false)
                        .then(async (data) => {
                            console.log('user not subscribed to room', data);
                            subscriber.subscriptions.push({
                                type: 'room',
                                _id: room._id,
                                payload: {
                                    user_id: user.sub,
                                    room_id: id
                                }
                            });
                            const saveSubscribe = await subscriber.save()
                                .then(async (subscriber) => {
                                    console.log('interest saved');
                                    // Add this subscriber to the interest
                                    room.subscribers.push( { user_id: subscriber._id });
                                    const saved = await room.save()
                                        .then((nSubscription) => {
                                            return { success: true };
                                        })
                                        .catch((err) => {
                                            console.log('error', err);
                                            return new UserInputError('Could not add user to room subscribers');
                                        });
                                    return saved;
                                })
                                .catch((err) => {
                                    console.error(err);
                                    return new UserInputError(err);
                                })
                            return saveSubscribe;
                        })
                        .catch(() => {
                            console.log('User already subscribed.')
                            return new UserInputError('Already subscribed to '+room['title']);
                        })
                    return checkValid;
                })
                .catch((err) => {
                    console.error('what', err);
                    throw new UserInputError('Something went wrong while fetching user data.');
                })
            return output;
        } else {
            throw new UserInputError("Room does not exist."); 
        }
    } else {
        throw new UserInputError("You must be logged in."); 
    }
}

module.exports.unsubscribe =  async (parent, { id }, { user }) => {
     // Make sure user exists
     console.log('user', user);
     let loggedIn = await User.findOne({ _id: user.sub });
     
     if (loggedIn) {
         console.log('loggedIn', loggedIn);
         // Lets make sure this slug exists on the database
         let room = await Room.findOne({ _id: id })
         
         if (room) {
             // Then lets remove this interest from the user
             console.log('room', room);
             const output = await User.findOne( { _id: user.sub })
                 .then( async (subscriber) => {
                     console.log('subscriber', subscriber);
                     // Lets see if this user has the interest slug already

                     const checkValid = await checkIfUserIsSubscribed(subscriber.subscriptions, id, true)
                         .then(async (subject) => {
                             console.log('user is subscribed to room', subject);

                             subscriber.subscriptions.remove(id);

                             const saveSubscribe = await subscriber.save()
                                 .then(async (subscriber) => {             
                                     let subscrition = [];
                                    room.subscribers.map((s, i) => {
                                        if (s.user_id === user.sub) {        
                                            room.subscribers.remove(s.user_id)
                                        }else{
                                            subscrition.push(s)
                                        }
                                     })
                                    room.subscribers = subscrition
                                     console.log("cccccc", room.subscribers)     

                                     const saved = await room.save()
                                         .then((nRoom) => {
                                             console.log('user removed from interest', nRoom);
                                             return { success: true };
                                         })
                                         .catch((err) => {
                                             console.log('error', err);
                                             return new UserInputError(err);
                                         });
                                     return saved;
                                 })
                                 .catch((err) => {
                                     console.error(err);
                                     return new UserInputError(err);
                                 })
                             return saveSubscribe;
                         })
                         .catch(() => {
                             console.log('User not subscribed to room.')
                             return new UserInputError('Already unsubscribed from '+room.slug);
                         })
                     return checkValid;
                 })
                 .catch((err) => {
                     console.error('what', err);
                     throw new UserInputError(err);
                 })
             return output;
         } else {
             throw new UserInputError("Interest does not exist."); 
         }
     } else {
         throw new UserInputError("You must be logged in."); 
     }
}

module.exports.subscription = (parent, args, context) => {
    return {
        subscribe: (parent, args, { pubsub }) => {
            console.log('sub params', args)
            return pubsub.asyncIterator('ROOM_UPDATED')
        }
    }
}

module.exports.rooms = async (parent, { start_at, limit }, { user }) => {
    if (!start_at) {
        start_at = 0;
    }

    if (!limit) {
        limit = 0;
    }

    let result = await Room.find({})
        .limit(limit)
        .skip(start_at)
        .then((result) => {
            console.log('results', result);
            return result;
        }).catch((err) => {
            console.error(err);
            return false;
        });
        
    return result;
};

const searchRooms = async (parent, { 
        search, 
        start_at, 
        limit,
        sort,
        interest,
        last_checked
    }, { user, indices }) => {
    
    const me = await User.findOne({ _id: user.sub })
    if (!me) {
        return new UserInputError('Not Authenticated')
    }

    const { rooms } = indices
    sort = ( sort == 'asc' ? 1 : -1)
    start_at = (!start_at ? 0 : start_at)
    limit = (!limit ? 0 : limit)
    interest = (!interest ? 'any' : interest)

    if (search && search.length) {
        // We use algolia
        let results = await rooms.search(search, {
            hitsPerPage: limit,
            page: start_at
        })

        //console.log('room_search_results', results)
        return results.hits
    } else {
        let findQuery = {}
        if (interest !== 'any') {
            findQuery['interests'] = interest
        }

        if (last_checked) {
            findQuery['createdAt'] = { $gt:last_checked }
        }

        let { socialCircle } = await GetSocialCircle(me)
        console.log('friends', socialCircle)

        let socialQuery = {}

        if (socialCircle.length > 0) {
            socialQuery['author'] = socialCircle 
        }
        
        // Lets only get rooms that we are allowed to see
        findQuery['$or'] = [
            {
                template: 'open'
            },
            {
                '$and': [
                    {
                        template: 'closed',
                    },
                    {
                        invitees: user.sub   
                    }
                ]
            },
            {
                '$and': [
                    {
                        template: 'social'
                    },
                    {
                        author: socialCircle
                    }
                ]
            },
            {
                author: user.sub
            }
        ]

        let results = await Room.find(findQuery)
            .sort({
                "updatedAt": sort
            })
            .limit(limit)
            .skip(start_at)
            .then(async result => {
                await Promise.all(result.map(async (room) => {
                    var broadcasters = [];
                    try {
                        if(room.broadcasters.length>0){
                            room.broadcasters.map(async (broadcast) => {
                                if (broadcast) {
                                    broadcasters.push(broadcast);       
                                }                             
                            })
                        }
                        room['broadcasters'] = broadcasters

                        let tmp_participants = {}
                        let tmp_participants_array = []
                        if (room.participants.length > 0) {
                            room.participants.forEach((p, i) => {
                                tmp_participants[p] = i
                            })
                            
                            Object.keys(tmp_participants).forEach(y => {
                                tmp_participants_array.push(y)
                            })
                            room['participants'] = tmp_participants_array
                        }

                        tmp_participants = {}
                        if (room.listening.length > 0) {
                            room.listening.forEach((p, i) => {
                                tmp_participants[p] = i
                            })
                            tmp_participants_array = []
                            Object.keys(tmp_participants).forEach(y => {
                                tmp_participants_array.push(y)
                            })
                            room['listening'] = tmp_participants_array
                        }
                    } catch (error) {
                    
                    }
                }))
                return result
            })
            .catch(err => {
                return new UserInputError(err)
            })
        return results
    }
}
module.exports.listNewRooms = async (parent, params, context) => {
    return searchRooms(parent, params, context)
}

module.exports.search = async (parent, params, context) => {
    return searchRooms(parent, params, context)
}

module.exports.room = async (parent, { id }, { user }) => {
    let room = await Room.findOne({ _id: id })
    if (!room) {
        console.error(err);
        return new UserInputError("That room does not exist.")
    }

    console.log('results', room);
    let broadcasters = []
    
    if (!room['broadcasters']) room['broadcasters'] = []
    if(room.broadcasters.length > 0){
        room.broadcasters.map(async (broadcast) => {
            if (broadcast) {
                broadcasters.push(broadcast);       
            }                             
        })
    }
    room['broadcasters'] = broadcasters

    let tmp_participants = {}
    let tmp_participants_array = []
    if (room.participants.length > 0) {
        room.participants.forEach((p, i) => {
            tmp_participants[p] = i
        })
        
        Object.keys(tmp_participants).forEach(y => {
            tmp_participants_array.push(y)
        })
        room['participants'] = tmp_participants_array
    }

    tmp_participants = {}
    if (room.listening.length > 0) {
        room.listening.forEach((p, i) => {
            tmp_participants[p] = i
        })
        tmp_participants_array = []
        Object.keys(tmp_participants).forEach(y => {
            tmp_participants_array.push(y)
        })
        room['listening'] = tmp_participants_array
    }

    return room
};


module.exports.sendRoomComment = async (parent, { roomID, message }, { user }) => {
    let room = await Room.findOne({ _id: roomID })

    if (!room) {
        return new UserInputError("Room does not exist.")
    }

    let sender = await User.findOne({ _id: user.sub })

    if (!sender) {
        return new UserInputError("Not authenticated.")
    }

    if (!message || !message.length) {
        return new UserInputError("Message required.")
    }
    
    let sendStatus = await sendComment(
        {
            userId: sender.id,
            profile_photo_url: sender.profile_photo_url,
            name: (sender.is_alias ? sender.alias : `${sender.first_name} ${sender.last_name}`),
            timestamp: new Date()
        }, 
        roomID, 
        message
    )
        .then(status => {
            if (status) {
                return { success: true }
            }
        })
        .catch(err => {
            return new UserInputError(err)
        })
    
    return sendStatus
}

module.exports.removeRoomComment = async (parent, { roomID, messageID }, { user }) => {
    let room = await Room.findOne({ _id: roomID })

    if (!room) {
        return new UserInputError("Room does not exist.")
    }

    let sender = await User.findOne({ _id: user.sub })

    if (!sender) {
        return new UserInputError("Not authenticated.")
    }

    if (!messageID) {
        return new UserInputError("Message required.")
    }

    let removeStatus = await removeComment(user.sub, roomID, messageID)
        .then(status => {
            if (status) {
                return { success: true }
            }
        })
        .catch(err => {
            return new UserInputError(err)
        })
    
    return removeStatus
}

module.exports.sendReaction = async (parent, { roomId, emoji }, { user }) => {
    let room = await Room.findOne({ _id: roomId })

    if (!room) {
        return new UserInputError("Room does not exist")
    }

    let sender = await User.findOne({ _id: user.sub })

    if (!sender) {
        return new UserInputError("Not authenticated.")
    }

    // Make sure we're using an emoji
    let isEmoji = /\p{Emoji}/u.test(emoji)
    console.log('isEmoji', isEmoji)

    if (!isEmoji) {
        return new UserInputError("Reaction must be an emoji.")
    }

    let sendStatus = await createReaction(user.sub, roomId, emoji)
        .then(status => {
            if (status) {
                return { success: true }
            }
        })
        .catch(err => {
            return new UserInputError(err)
        })

    return sendStatus
}

module.exports.subscriptions = {
    RoomUpdated: {
        subscribe: withFilter(
            (parent, args, context) => {
                console.log('the context for room', context)
                const { pubsub } = context
                return pubsub.asyncIterator([
                    'ROOM_UPDATED',
                    'USER_JOINED_ROOM',
                    'USER_RAISED_HAND',
                    'USER_JOINED_LINEUP',
                    'USER_LEFT_ROOM',
                    'LINEUP_REQUEST_ACCEPTED',
                    'USER_STARTED_BROADCAST',
                    'USER_ENDED_BROADCAST',
                    'ROOM_DELETED'
                ])
            },
            async (payload, variables) => {
                console.log('payload', payload)
                console.log('variables', variables)

                return (`${payload.RoomUpdated.room['_id']}` === variables.id)
            }
        )
    },
    RoomListUpdates: {
        subscribe: withFilter(
            (parent, args, {pubsub}) => {
                return pubsub.asyncIterator([
                    'ROOM_UPDATED',
                    'ROOM_DELETED'
                ])
            },
            async (payload, variables) => {
                console.log('payload', payload)
                console.log('variables', variables)

                let success = false
                variables.rooms.forEach(id => {
                    if (payload.RoomListUpdates.room['_id'] == id) {
                        console.log('it exists')
                        success = true
                    }
                })
                return success
                //return (`${payload.RoomUpdated.room['_id']}` === variables.id)
            }
        )
    }
}