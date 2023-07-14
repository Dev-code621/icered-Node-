const apollo = require('apollo-server-express');
const admin = require('./firebase.db')
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI('91a4fdc5d3aa4773983c8f421ad7fdec');

const Post = require('./resolvers/post');
const Rooms = require('./resolvers/room');
const Newsfeed = require('./resolvers/newsfeed');
const Users = require('./resolvers/user');
const Comments = require('./resolvers/comment');
const Alias = require('./resolvers/alias')
const Alerts = require('./resolvers/alerts')
const Tokens = require('./resolvers/tokens')
const Reports = require('./resolvers/reports')
const Conversations = require('./resolvers/conversations')
const Guest = require('./resolvers/guest');

const PostM = require('./models/Post.model');
const ReplyM = require('./models/Reply.model');
const User = require('./models/User.model');
const Room = require('./models/Room.model');
const Interest = require('./models/Interest.model');
const { count } = require('./models/Room.model');

const UserInputError = apollo.UserInputError;

module.exports = {
    Author: Users.author,
    Participant: Rooms.participant,
    UserSubscription: Users.userSubscriptionQuery,
    UserRef: Users.userRef,
    RepliesPreview: Newsfeed.repliesPreview,
    RoomSetting: Rooms.setting,
    Room: Rooms.schema,
    Post: Post.schema,
    Conversation: Conversations.schema,
    Contact: Conversations.contact,
    UserPublic: Users.author,
    Query: {
        users: Users.list,
        userProfile: Users.profile,
        viewer: Users.me,
        alerts: Alerts.alerts,
        getPostByID: Newsfeed.getPostByID,
        getPostsByAuthor: Newsfeed.getPostsByAuthor,
        getPostByAuthor: Newsfeed.getPostsByAuthor,
        getPostRepliesByID: Newsfeed.getPostRepliesByID,
        getPosts: Newsfeed.getPosts,
        rooms: Rooms.search,
        getRoom: Rooms.room,
        getNewRooms: Rooms.listNewRooms,
        interests: Newsfeed.interests,
        interest: Newsfeed.getInterest,
        getFeed: Newsfeed.algorithm,
        getComments: Comments.getComments,
        userSearch: Users.searchProfiles,
        aliases: Alias.listAliases,
        listaliases: Alias.AllAliases,

        listReports: Reports.list,

        // Contacts System
        listContactInvites: Conversations.listContactInvites,
        inbox: Conversations.listConversations,
        listBroadcastRequests: Rooms.listBroadcastRequests
    }, 
    Mutation: {
        updateUser: Users.update,
        updateEmail: Users.updateBackupEmail,
        verifyEmail: Users.verifyBackupEmail,
        register: Users.register,
        verifyPhoneNumber: Users.verifyPhoneNumber,
        login: Users.login,
        refreshJWT: Users.refreshJWT,
        startLoginFlow: Users.startLoginFlow,
        blockUser: Users.blockUser,
        phoneContactUsers:Users.phoneContactUsers,



        subscribeToInterest: Users.subscribeToInterest,
        unsubscribeFromInterest: Users.unsubscribeFromInterest,
        roomCreate: Rooms.create,
        roomActions: Rooms.actions,
        subscribeToRoom: Rooms.subscribe,
        unsubscribeFromRoom: Rooms.unsubscribe,
        closeRoom: Rooms.disable,

        postCreate: Post.create, 
        postEdit: Post.edit,
        postDelete: Post.delete,
        postActions: Post.actions,
        replyCreate: Post.reply, 
        replyActions: Post.reply_actions,
        hidePost: Post.hide,

        joinRoomAndsubscribe: Rooms.join,
        roomDelete: Rooms.delete,
        roomEdit: Rooms.update,
        leaveRoom: Rooms.leave,
        stopBroadcasting: Rooms.stopBroadcasting,
        broadcast: Rooms.broadcast,
        leaveBroadcastQueue: Rooms.leaveBroadcastQueue,
        manageBroadcastRequest: Rooms.manageBroadcastRequest,
        inviteUserRoom: Rooms.inviteUserRoom,

        followUser: Users.followUser,
        unfollowUser: Users.unfollowUser,
        active: Users.active,
        // post Comment
        postComment:Comments.postComment,
        commentLike: Comments.commentLike,
        createAlias: Alias.createAlias,
        editAlias: Alias.editAlias,
        deleteAlias: Alias.deleteAlias,
        createAliasToken: Alias.getAliasToken,
        logout: Users.logout,
        readAlert: Alerts.readAlert,

        // tip post author
        tipUser: Tokens.tipUser,
        sendRoomComment: Rooms.sendRoomComment,
        removeRoomComment: Rooms.removeRoomComment,

        // Community Moderation
        reportUser: Reports.reportUser,
        reportPost: Reports.reportPost,
        reportPostComment: Reports.reportPostComment,
        reportRoom: Reports.reportRoom,
        reportRoomComment: Reports.reportRoomComment,

        sendRoomReaction: Rooms.sendReaction,

        // Email Login
        sendEmailLoginCode: Users.sendEmailLoginCode,
        verifyEmailLoginCode: Users.verifyEmailLoginCode,
        
        //Block user or Post
        isBlocked: Users.isBlocked,

        inviteUser: Users.inviteReferral,
        cancelInvite: Users.cancelReferral,
        inviteUserRoomMulti: Rooms.inviteUserRoomMulti,
        

        // Contacts System
        inviteContact: Conversations.inviteContact,
        acceptContactInvite: Conversations.acceptContactInvite,
        rejectContactInvite: Conversations.rejectContactInvite,
        cancelContactInvite: Conversations.cancelContactInvite,

        // Direct Messaging System
        createConversation: Conversations.createConversation,
        leaveConversation: Conversations.leaveConversation,
        createDirectMessage: Conversations.sendMessage,
        deleteDirectMessage: Conversations.deleteMessage,
        readConversation: Conversations.readConversation,
        archiveConversation: Conversations.archiveConversation,
        unarchiveConversation: Conversations.unarchiveConversation,

        //Guest
        guestLogin: Guest.guestLogin,

        testAlert: Alerts.testAlert,
    },
    Subscription: {
        RoomUpdated: Rooms.subscriptions.RoomUpdated,
        RoomListUpdates: Rooms.subscriptions.RoomListUpdates,
        Notifications: Alerts.subscriptions.Notifications
    }
};