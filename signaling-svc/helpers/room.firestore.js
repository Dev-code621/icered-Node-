const admin = require("../firebase.db")
const db = admin.firestore()

const Room = require('../models/Room.model')
const User = require('../models/User.model')

const createLiveRoom = module.exports.createLiveRoom = (room_id) => {
    return new Promise(async (resolve, reject) => {
        let room = await Room.findOne({ _id: room_id})

        if (!room) {
            return resolve("Room does not exist: " + room_id)
        }

        let roomsCollection = await db
            .doc(`rooms/${room_id}`)
            .set({
                title: room['title']
             }, { merge: true })

        return resolve(roomsCollection)
    })
}

// Sync live room on Firebase
const syncLiveRoom =   module.exports.syncLiveRoom = async (room_id) => {
    return new Promise(async (resolve, reject) => {
        let room = await Room.findOne({ _id: room_id })

        // Lets sync the room details
        let roomsCollection = await db.collection('rooms')
        //console.log('room  id is', room_id)
        const roomRef = db.doc(`rooms/${room_id}`)

        if (!room) {
            let roomExists = await roomRef.get()

            // Remove dangling room comments??
            if (roomExists.exists) {
                await roomRef.delete()
            }

            return reject("Room not found")
        }

        await roomRef.set({
                title: room['title']
            }, { merge: true })

        const roomParticipantsRef = await roomRef.collection('participants')
        const roomCommentsRef = await roomRef.collection('comments')
        
        // sync the room participants
        const participants = room['participants']
        
        //console.log('participants in room', participants)
        let participantsAssoc = {}
        participants.forEach(async (participantId) => {
            let participant = await User.findOne({ _id: participantId })
            if (participant) {
                //console.log('the participant', participant['_id'])
                participantsAssoc[participantId] = participantId
            
                // Does the participant exist in the firestore collection already?
                let roomParticipantRef = roomParticipantsRef.doc(participantId)
                let roomParticipant = await roomParticipantRef.get()
                

                // console.log('firestore participant', roomParticipant)

                // if not, then add them to the firestore collection and output a joined message
                
                    let is_moderator = false
                    let is_broadcaster = 0
                    let can_comment = true

                    room.moderators.forEach((usr) => {
                        if (participantId === usr) {
                            is_moderator = true
                        }
                    })

                    room.blacklist.forEach((usr) => {
                        if (participantId === usr) {
                            can_comment = false
                        }
                    })

                    room.broadcasters.forEach((usr) => {
                        if (participantId === usr) {
                            is_broadcaster = 2
                        }
                    })

                    roomParticipantRef.set({
                        is_author: (room['author'] === participantId ? true : false),
                        can_comment,
                        is_moderator,
                        is_broadcaster,
                        name: participant['first_name']
                    }, { merge: true })

                    if (!roomParticipant.exists) {
                        // Send join message from participant
                        let res = await roomCommentsRef.add({
                            message: `**joined**.`,
                            author: `${participant['_id']}`,
                            profile_photo_url: participant.profile_photo_url,
                            name: (participant.is_alias ? participant.alias : `${participant.first_name} ${participant.last_name}`),
                            timestamp: new Date()
                        })
                       // console.log('added comment as ', res.id)
                    }
                
            }
        })
        
        console.log('participantAssoc', participantsAssoc);
        
        let snapshot = await roomParticipantsRef.get()
        snapshot.forEach(async doc => {
            if (!participantsAssoc[doc.id]) {
                doc.delete()
            }
        })
        // console.log('firestore room participants', snapshot)

        resolve(true)
    })
}

module.exports.sendComment = async (user, room_id, message) => {
    return new Promise(async (resolve, reject) => {
        let room = await Room.findOne({ _id: room_id })

        if (!room) {
            return reject('Room does not exist')
        }

        const {
            userId,
            profile_photo_url,
            name,
            timestamp
        } = user
        
        // Lets sync the room details
        let roomsCollection = await db.collection('rooms')
        // console.log('room  id is', room_id)
        const roomRef = db.doc(`rooms/${room_id}`)
        let roomExists = await roomRef.get()

        if (!roomExists) {
            await createLiveRoom(room_id).then( async res => {
                await syncLiveRoom(room_id).then(result => {
                    //console.log('liveRoom sync result', result)
                }).catch(err => {
                    console.log('liveRoom sync err', err)
                })
            })
            // return reject("Something went wrong, you can't submit a comment here.")
        }

        // Is this user a participant?
        let participant = await db.doc(`rooms/${room_id}/participants/${userId}`).get()

        if (!participant.exists) {
            await syncLiveRoom(room_id).then(result => {
                //console.log('liveRoom sync result', result)
            }).catch(err => {
                console.log('liveRoom sync err', err)
            })
            // return reject("You must be a participant to submit a comment.")
        }

        await roomRef.collection('comments').add({
            message,
            author: userId,
            profile_photo_url,
            name,
            timestamp
        }).then(() => {
            resolve(true)
        })
    })
}

module.exports.createReaction = async (user_id, room_id, emoji) => {
    return new Promise(async (resolve, reject) => {
        let room = await Room.findOne({ _id: room_id })

        if (!room) {
            return reject("Room does not exist.")
        }

        let roomsCollection = await db.collection('rooms')

        const roomRef = db.doc(`rooms/${room_id}`)
        let roomExists = await roomRef.get()

        if (!roomExists) {
            return reject("Something went wrong, you can't react to this room.")
        }

        let participant = await db.doc(`rooms/${room_id}/participants/${user_id}`).get()
        if (!participant.exists) {
            return reject("You must be a participant to submit a comment.")
        }

        await roomRef.collection('reactions').add({
            emoji,
            author: user_id,
            timestamp: new Date()
        }).then(() => {
            resolve(true)
        })
        .catch(err => {
            reject(err)
        })
    })
}

module.exports.removeComment = async (user_id, room_id, message_id) => {
    return new Promise(async (resolve, reject) => {
        let room = await Room.findOne({ _id: room_id })

        if (!room) {
            return reject('Room does not exist')
        }

        const roomRef = db.doc(`rooms/${room_id}`)
        let roomExists = await roomRef.get()

        if (!roomExists) {
            return reject("Something went wrong, you can't submit a comment here.")
        }

        // Is this user a participant? author? moderator?
        let can_delete = false
        let messageRef = db.doc(`rooms/${room_id}/comments/${message_id}`)
        let message = await messageRef.get()
        if (message.exists) {
            let data = message.data()
            if (data.author === user_id) {
                can_delete = true
            }

        } else {
            return reject("The message doesn't exist.")
        }

        if (room['author'] === user_id) {
            can_delete = true
        }

        if (can_delete) {
            await messageRef.delete()
            return resolve(true)
        } else {
            return reject('Insufficient permissions.')
        }

    })
}

