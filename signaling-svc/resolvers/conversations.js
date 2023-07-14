const apollo = require('apollo-server-express')
const admin = require('../firebase.db')
const db = admin.firestore()

const User = require('../models/User.model')
const Conversation = require('../models/Conversation.model')

const UserInputError = apollo.UserInputError

const { 
    sendAlerts
} = require('../helpers/alerts.helper')

const helpers = require('../helpers')
const UserIdInList = helpers.UserIdInList

const authenticateJWT = helpers.authenticateJWT

const sendConversationAlerts = (participants, data) => {
    return new Promise(async (resolve, reject) => {
        // Lets make sure all participants exist
        let returnThis = await User.find({
            _id: {
                $in: participants
            }
        })

        let {
            message,
            title,
            link,
            link_type,
            icon
        } = data;

        console.log('return this participants', returnThis)
        // @tao - Complete function from here, we must send alerts about this conversation

        resolve(true)
    })
}
module.exports.contact = {
   info: async parent => {
        console.log('contact info parent', parent)
        let userData = await User.findOne({ _id: parent['userId']})
        if (!userData) {
            return {
                name: "Deleted User",
                account_type: 'deleted',
                name_type: 'full_name',
                is_bot: false,
                username: 'Deleted User'
            }
        }
        // Get name
        let name = userData['alias']
        let name_type = 'alias'
        let account_type = 'alias'

        if (!userData['is_alias']) {
            name = userData['first_name']
            name_type = 'full_name'
            account_type = 'primary'

            if (userData['last_name'] && userData['last_name'] !== '') {
                name = `${userData['first_name']} ${userData['last_name']}`
            }
        }

        if (userData['is_bot']) {
            account_type = 'bot'
        }

       return {
            id: parent['userId'],
            name,
            account_type,
            profile_photo_url: userData['profile_photo_url'],
            is_bot: userData['is_bot'],
            name_type,
            username: name
        }
   }
}

module.exports.schema = {
    id: async parent => {
        console.log('conversation id', parent)
        return parent._id
    }
}


/* Contacts API */

module.exports.inviteContact = async (__, { userID }, { user, indices }) => {
    // Make sure we're signed in
    if (!user.sub) {
        throw new UserInputError('Not authenticated.')
    }

    let me = await User.findOne({ _id: user.sub })
    if (!me) {
        throw new UserInputError('We experienced an issue accessing your account')
    }

    if (!userID) {
        throw new UserInputError('User not supplied.')
    }

    if (user.sub == userID) {
        throw new UserInputError('You cannot add yourself as a Contact')
    }

    // Lets see if this user is already a contact
    let exists = false
    me['contacts'].forEach(contact => {
        if (contact['userId'] == userID) {
            exists = true
        }
    })
    if (exists) {
        throw new UserInputError('User is already a Contact.')
    }

    // Lets make sure invitation isn't already sent
    exists = false
    me['contact_requests'].forEach(contact => {
        if (contact['userId'] == userID) {
            exists = true
        }
    })
    if (exists) {
        throw new UserInputError('You already sent a Contact request to this user.')
    }

    // Lets make sure invitation isn't already sent
    exists = false
    me['contact_invites'].forEach(contact => {
        if (contact['userId'] == userID) {
            exists = true
        }
    })
    if (exists) {
        throw new UserInputError('This user is already waiting for you to accept their Contact request.')
    }

    let invitee = await User.findOne({ _id: userID })
    if (!invitee) {
        throw new UserInputError('User does not exist.')
    }

    invitee['contact_invites'] = (!invitee['contact_invites'] ? [] : invitee['contact_invites'])
    me['contact_requests'] = (!me['contact_requests'] ? [] : me['contact_requests'])
    me['contacts'] = (!me['contacts'] ? [] : me['contacts'])

    let can_add = true

    if (me['contacts'].length > 0) {
        me['contacts'].forEach(contact => {
            if (contact['userId'] == userID) {
                can_add = false
            }
        })
    }

    if (can_add) {
        me['contact_requests'].push({
            userId: userID
        })

        invitee['contact_invites'].push({
            userId: user.sub
        })

        let saved = await me.save()
        let savedd = await invitee.save()

        return { success: true }
    } else {
        throw new UserInputError('User already in contacts.')
    }
}

module.exports.listContactInvites = async (__, { limit, page }, { user, indices }) => {
    if (!user.sub) {
        throw new UserInputError('Not authenticated.')
    }

    limit = limit ? limit : 25
    page = page ? page : 1

    let me = await User.findOne({ _id: user.sub })
    let invites = me['contact_invites'] ? me['contact_invites'] : []

    console.log('invites list', invites)
    return invites
}

module.exports.listOutgoingContactInvites = async (__, { limit, page }, { user, indices }) => {
    if (!user.sub) {
        return new UserInputError(`Not authenticated.`)
    }

    limit = limit ? limit : 25
    page = page ? page : 1

    let me = await User.findOne({ _id: user.sub })
    let requests = me['contact_requests'] ? me['contact_requests'] : []

    console.log('requests list', requests)
    return requests
}

module.exports.acceptContactInvite = async (__, { id }, { user, indices }) => {
    if (!user.sub) {
        throw new UserInputError('Not authenticated.')
    }

    let me = await User.findOne({ _id: user.sub })

    if (!me) {
        return new UserInputError('Cannot locate account.')
    }

    let invites = me['contact_invites'] ? me['contact_invites'] : []
    let removed = false
    let sender;
    if (invites.length > 0) {
        // Get requester
        const getRequester = () => {
            return new Promise(async (resolve, reject) => {
                let checkit = false
                invites.forEach(async (invite, i) => {
                    if (invite['_id'] == id) {
                        let requester = await User.findOne({ _id: invite['userId'] })
                        if (!requester) {
                            let savedd = await me.save()
                            reject('Requester does not exist. We removed this request for you.')
                        }
                        resolve({ requester, theInvite: invite })
                        checkit = true
                    } else {
                        if (i == (invites.length - 1)) {
                            reject(`Couldn't find an invitation by that ID`)
                        }
                    }

                })
            })
        }
        let getInvite = await getRequester()
            .catch((err) => {
                throw new UserInputError(err)
            })
        let {
            requester,
            theInvite
        } = getInvite

        invites.forEach(async (invite, i) => {
            if (invite['_id'] == id) {
                // Lets add the contact to requester and me
                me['contacts'] = (!me['contacts']) ? [] : me['contacts']
                console.log('theInvite', theInvite)
                me['contacts'].push(theInvite)
                // delete invites[i]
                me['contact_invites'] = invites.filter(inv => {
                    if (inv['_id'] !== invite['_id']) {
                        return inv
                    }
                })
                removed = true
            }
        })
        
        if (removed) {
            console.log('resulting_invites', me.contact_invites)

            // Remove this request for the sender
            removed = false
            requester['contact_requests'].forEach((request, i) => {
                if (request['userId'] == me['_id']) {
                    requester['contacts'] = (!requester['contacts']) ? [] : requester['contacts']
                    requester['contacts'].push(request)
                    requester.contact_requests = requester['contact_requests'].filter(cr => {
                        if (cr['_id'] !== request['_id']) {
                            return cr
                        }
                    })
                    // delete requester['contact_requests'][i]
                    removed = true
                }
            })

            if (!removed) {
                return {success: false, message: `That's weird. That user didn't send you a request.`}
            }

            let saved_requester = await requester.save()
            .catch(err => {
                console.error(err)
                throw new UserInputError("Could not save contact. Likely an issue with requester.")
            })

            console.log('my new contacts', me['contacts'])
            let saved = await me.save()
                .catch(err => {
                    console.error(err)
                    throw new UserInputError("Could not save contact. Likely an issue with your account.")
                })
            return { success: true }
        } else {
            return new UserInputError('That invite does not exist.')
        }
    } else {
        return new UserInputError(`You don't have any invites to accept.`)
    }
    
}

module.exports.rejectContactInvite = async (__, { id }, { user, indices }) => {
    if (!user.sub) {
        return new UserInputError(`Not authenticated.`)
    }

    // Lets see if this is a valid request
    let me = await User.findOne({ _id: user.sub })
    if (!me) {
        return new UserInputError(`Unable to locate account.`)
    }

    let invites = me['contact_invites']
    let pass = false
    let theInvite = null
    invites.forEach(invite => {
        if (invite['_id'] == id) {
            pass = true
            theInvite = invite
        }
    })

    if (!pass) {
        return new UserInputError(`That contact invite does not exist.`)
    }

    // Lets see if this request is an invite for the other user
    console.log('theInvite', theInvite)
    me['contact_invites'] = invites.filter(invite => {
        if (invite['_id'] !== id) {
            return invite
        }
    })
   /* let recipient = await User.findOne({ _id: theInvite['userId'] })
    
    if (!recipient) {
        let saved = await me.save()
            .catch(err => {
                console.error(err)
                throw new UserInputError(`Unable to remove the invalid request. This error has been reported.`)
            })
        
        return { success: true }
    }

    recipient['contact_invites'] = recipient['contact_invites'].filter(invite => {
        if (invite['userId'] !== me.id) {
            return invite
        }
    })
    
    let saved = await recipient.save()
        .catch(err => {
            console.error(err)
            throw new UserInputError(`Could not remove contact request.`)
        })
    */
    saved = await me.save()
        .catch(err => {
            console.error(err)
            throw new UserInputError(`Could not remove contact invite.`)
        })
    
    return { success: true }
}

module.exports.cancelContactInvite = async (__, { id }, { user, indices }) => {
    if (!user.sub) {
        return new UserInputError(`Not authenticated.`)
    }

    // Lets see if this is a valid request
    let me = await User.findOne({ _id: user.sub })
    if (!me) {
        return new UserInputError(`Unable to locate account.`)
    }

    let requests = me['contact_requests']
    let pass = false
    let theRequest = null
    requests.forEach(request => {
        if (request['_id'] == id) {
            pass = true
            theRequest = request
        }
    })

    if (!pass) {
        return new UserInputError(`That contact request does not exist.`)
    }

    // Lets see if this request is an invite for the other user
    console.log('theRequest', theRequest)
    me['contact_requests'] = requests.filter(request => {
        if (request['_id'] !== id) {
            return request
        }
    })
    let recipient = await User.findOne({ _id: theRequest['userId'] })
    
    if (!recipient) {
        let saved = await me.save()
            .catch(err => {
                console.error(err)
                throw new UserInputError(`Unable to remove the invalid request. This error has been reported.`)
            })
        
        return { success: true }
    }

    recipient['contact_invites'] = recipient['contact_invites'].filter(invite => {
        if (invite['userId'] !== me.id) {
            return invite
        }
    })

    let saved = await recipient.save()
        .catch(err => {
            console.error(err)
            throw new UserInputError(`Could not remove contact request.`)
        })
    
    saved = await me.save()
        .catch(err => {
            console.error(err)
            throw new UserInputError(`Could not remove contact request.`)
        })
    
    return { success: true }
}

/* Messaging API */

module.exports.createConversation = async (__, { recipients }, { user, indices }) => {
    if (!user.sub) {
        throw new UserInputError('Not authenticated.')
    }

    let me = await User.findOne({ _id: user.sub })

    if (!me) {
        throw new UserInputError('Unable to find your account. Try logging in again.')
    }
    // Now lets add participants
    recipients.push(user.sub)

    // Lets make sure all recipients are real
    let verifyRecipients = (user_id_list) => {
        return new Promise(async (resolve, reject) => {
            resolve(true)
        })
    }

    let recipientData = await verifyRecipients(recipients)
        .catch(err => {
            console.log('error verifiying convo recipient', err)
            throw new UserInputError('A specified recipient does not exist.')
        })
    
    // Lets create the conversation
    let conversationObj = new Conversation({
        participants: recipients
    })

    let conversation = await conversationObj
        .save()
        .then(doc => {
            return doc
        })
        .catch(err => {
            console.error(err)
            throw new UserInputError('Could not create conversation. The issue has been logged.')
        })
    
    let conversationId = conversation.id
    let createdAt = conversation.createdAt

    let saved = await db
        .doc(`conversations/${conversationId}`)
        .set({
            hidden: false,
            participants: recipients
        }).then(async (doc) => {
            console.log('added convo res', doc)
            let last_message = "This is the start of a great conversation"
            let last_message_from = "system"
            let last_message_time = Date.now()

            let res = await db.collection(`conversations/${conversationId}/messages`).add({
                from: last_message_from,
                message: last_message
            }).then( async () => {

                return { 
                    id: conversationId,
                    ...conversation._doc
                }
            })

            return res
        })
        .catch((err) => {
            console.log('err creating convo', err)

            throw new UserInputError('Could not create conversation.')
        })
    
    return saved
}

module.exports.leaveConversation = async (__, { id }, { user, indices }) => {
    if (!user.sub) {
        return new UserInputError('Not authenticated.')
    }

    let me = await User.findOne({ _id: user.sub })

    if (!me) {
        return new UserInputError('Could not locate your account.')
    }

    let conversation = await Conversation.findOne({ _id: id, participants: user.sub })
        .catch(err => {
            console.log(err)
            throw new UserInputError('Conversation not found.')
        })
    
    conversation['participants'] = conversation.participants.filter(participant => {
        if (participant !== me.id) {
            return participant
        }
    })

    if (conversation.participants.length < 2) {
        return new UserInputError(`Can't leave a 1-on-1 conversation. You can always remove a contact, though!`)
    }

    let saved = await conversation.save()
        .catch(err => {
            console.error(err)
            throw new UserInputError(`Couldn't remove you from this conversation.`)
        })
    
    // Lets remove from firebase conversation
    let convo = db.doc(`conversations/${id}`)
    
    let savedConvo = await convo.set({
        participants: conversation['participants']
    }, {
        merge: true
    }).catch(err => {
        console.error(err)
        throw new UserInputError(`Couldn't update conversation.`)
    })

    return { success: true }

} 

// Message Batch is in case we are sending multiple messages; 
// ie in the case of multiple media uploads they will be one message each

const sendMessageBatch = async (batch, conversationId, me) => {
    return new Promise(async (resolve, reject) => {
        let sentMessages = []
        batch.forEach(async (m, i) => {
            console.log('sending message', m)
            m['createdAt'] = new Date()
            let sentMessage = await db.collection(`conversations/${conversationId}/messages`)
                .add(m)
                .catch((err) => {
                    console.log('Error sending message')
                    console.error(err)
                })
                
            sentMessages.push(m)

            // This just makes sure we are saving the most recent message sent
            conversation.last_message_from = me.id
            conversation.last_message_type = m.type
            conversation.last_message = m.message
            conversation.last_message_time = Date.now()

                // Now lets send a notification to every user except me
            let alert_participants = conversation.participants.filter(participant => {
                if (participant !== me.id) {
                    return participant
                }
            })

            let alertData = {
                message: `${me['first_name']}: ${m.message}`,
                title: `${me['first_name']}${me['last_name'] ? " " + me['last_name'] : ""}`,
                link: `conversation/${conversationId}`,
                link_type: 'message',
                icon: me['profile_photo_url']
            }

            let alertsSent = await sendConversationAlerts(alert_participants, alertData)
                
            if (i == (batch.length - 1)) {
                resolve(sentMessages)
            }
        })
    })
}

module.exports.sendMessage = async (__, params, { user, indices }) => {
    if (!user.sub) {
        return new UserInputError('Not authenticated.')
    }

    let me = await User.findOne({ _id: user.sub })

    if (!me) {
        return new UserInputError('Could not locate your account.')
    }

    let { 
        message, 
        attachments, 
        mentions, 
        type, 
        conversationId 
    } = params

    let conversation = await Conversation.findOne({ _id: conversationId, participants: me.id })
    if (!conversation) {
        return new UserInputError('Conversation not found.')
    }

    let messageBatch = []

    // Lets make sure the type is valid
    switch(type) {
        case 'image':
            // Make sure we have attached image(s)
            if (message) {
                messageBatch.push({
                    message,
                    from: `${me.id}`,
                    type: "text"
                })
            }

            attachments.forEach(attachmentString => {
                let attachment = attachmentString.split(';')
                let attachment_type = attachment[0]
                let attachment_url = attachment[1]

                if (attachment_type == 'image') {
                    let thisMessage = "Sent a photo."

                    messageBatch.push({
                        thisMessage,
                        attachment_url,
                        from: `${me.id}`,
                        type: "image"
                    })
                }
            })
        break;
        case 'link':
            // Make sure we have attached image(s)
            if (message) {
                messageBatch.push({
                    message,
                    from: `${me.id}`,
                    type: "text"
                })
            }

            attachments.forEach(attachmentString => {
                let attachment = attachmentString.split(';')
                let attachment_type = attachment[0]
                let attachment_url = attachment[1]

                if (attachment_type == 'url') {
                    let thisMessage = "Sent a link."

                    messageBatch.push({
                        thisMessage,
                        attachment_url,
                        from: `${me.id}`,
                        type: "link"
                    })
                }
            })
        break;
        case 'video':
            // Make sure we have attached video(s)
            if (message) {
                messageBatch.push({
                    message,
                    from: `${me.id}`,
                    type: "text"
                })
            }

            attachments.forEach(attachmentString => {
                let attachment = attachmentString.split(';')
                let attachment_type = attachment[0]
                let attachment_url = attachment[1]

                if (attachment_type == 'video') {
                    let thisMessage = "Sent a video message."

                    messageBatch.push({
                        thisMessage,
                        attachment_url,
                        from: `${me.id}`,
                        type: "video"
                    })
                }
            })
        break;
        case 'audio':
            // Make sure we attached audio(s)
            if (message) {
                messageBatch.push({
                    message,
                    from: `${me.id}`,
                    type: "text"
                })
            }

            attachments.forEach(attachmentString => {
                let attachment = attachmentString.split(';')
                let attachment_type = attachment[0]
                let attachment_url = attachment[1]

                if (attachment_type == 'audio') {
                    let thisMessage = "Sent an audio message."

                    messageBatch.push({
                        thisMessage,
                        attachment_url,
                        from: `${me.id}`,
                        type: "audio"
                    })
                }
            })
        break;
        case 'text':
        default:
            // Make sure we have attached text
            if (!message) {
                throw new UserInputError(`You can't just send an empty message!`)
            }

            messageBatch.push({
                message,
                from: `${me.id}`,
                type: "text"
            })
        break;
    }

    let sentMessages = await sendMessageBatch(messageBatch, conversationId, me)
    
    // Save the conversation
    let success = await conversation.save()
        .catch(err => {
            console.error(err)
            return new UserInputError(`There was an issue updating the conversation. This issue has been received by staff.`)
        })
    
    // Lets save the conversation in firestore
     return { success: true }
    return success
}

module.exports.deleteMessage = async (__, { messageId, conversationId }, { user, indices }) => {

}

module.exports.listConversations = async (__, { limit, page }, { user, indices }) => {
    if (!user.sub) {
        throw new UserInputError('Not authenticated.')
    }

    let me = await User.findOne({ _id: user.sub })
    if (!me) {
        throw new UserInputError('Could not locate your account.')
    }

    let conversations = await Conversation.find({ participants: me.id, hidden: false })

    return conversations;
}

module.exports.readConversation = async (__, { id }, { user, indices }) => {
    // Mark a conversation as read
}

// Archived conversation is when a conversation is "hidden"

module.exports.listArchivedConversations = async (__, params, { user, indices }) => {
    // Show conversations that are hidden: true
}
module.exports.archiveConversation = async (__, { id }, { user, indices }) => {
    // Mark a conversation as hidden: true
}

module.exports.unarchiveConversation = async (__, { id }, { user, indices }) => {
    // Mark a conversation as hidden: false
}