const gql = require('apollo-server-express').gql;
module.exports = gql`
    type Error {
        message: String
    }

    type AlertButton {
        label: String,
        type: String,
        link: String,
        link_type: String,
        icon: String
    }
    
    type Interest {
        id: ID,
        label: String,
        slug: String,
        description: String,
        image_url: String,
        subscriber_count: String,
        subscribed: Boolean,
        category: String,
        parents: [String],
        type: String
    }

    type UserInterest {
        id: ID,
        slug: String
    }

    type UserSubscription {
        id: ID,
        type: String,
        payload: String
    }

    type UserRef {
        id: ID,
        display_name: String,
        user_id: String,
        last_active: String
    }

    type User {
        id: ID,
        first_name: String,
        last_name: String,
        phone_country_code: String,
        phone: String,
        alias: String,
        location: String,
        full_phone_number: String,
        phone_verified: Boolean,
        profile_photo_url: String,
        interests: [UserInterest],
        subscriptions: [UserSubscription],
        following: [UserRef],
        followers: [UserRef],
        date: String,
        anonymous: Boolean,
        alerts: [Alert],
        profile_complete: Boolean,
        last_active: String,
        status:Boolean,
        is_alias:Boolean,
        email: String,
        tokens: Float,
        referrals_available: Int,
        userBlocked:Boolean,
        userLevel:Int,
        ownerUserId:String,
    }
    
    type LoginResponse {
        status: String,
        url: String
    }

    type JwtResponse {
        jwt: String,
        refreshToken: String,
        refresh_expiration: String,
        jwt_expiration: String,
        author: User
    }

    type SuccessStatus {
        success: Boolean,
        message: String
    }
    type PostActionsSuccess {
        success: Boolean,
        likes: String,
        dislikes: String
    }

    type Participant {
        id: String,
        name: String,
        name_type: String,
        account_type: String,
        profile_photo_url: String,
        status: Boolean
    }

    type RoomSetting {
        private: Boolean,
        chat: Boolean,
        video: Boolean,
        audio: Boolean,
        public: Boolean,
        invite_only: Boolean,
        network_only: Boolean
    }

    type LineupRequest {
        userID: String,
        approved: Boolean,
        answered: Boolean,
        participant: Participant
    }

    type Room {
        id: ID,
        title: String,
        description: String,
        author: Author,
        settings: RoomSetting,
        participants: [Participant],
        interests: [String],
        blacklist: [Participant],
        moderators: [Participant],
        broadcasters: [Participant],
        createdAt: String,
        updatedAt: String,
        index_type: String,
        index: Int,
        live: Boolean,
        disabled: Boolean,
        template: String,
        line_up: [Participant],
        listening: [Participant],
        invitees: [Participant],
        hands_raised: [LineupRequest]
    }

    type Author {
        id: String,
        name: String,
        name_type: String,
        profile_photo_url: String,
        is_bot: Boolean,
        account_type: String,
        username: String
    }

    type UserPublic {
        id: String,
        name: String,
        name_type: String,
        profile_photo_url: String,
        is_bot: Boolean,
        account_type: String,
        username: String
    }

    type Alert {
        id: ID,
        message: String,
        type: String,
        title: String,
        subtext: String,
        link: String,
        link_type: String,
        read: Boolean
        buttons: [AlertButton],
        createdAt: String,
        users: [Author]
    }

    type Attachment {
        id: String,
        author: Author,
        type: String,
        data: String
    }

    type Reply {
        id: String,
        author: Author, 
        message: String,
        post: String,
        children: [String],
        attachments: [Attachment],
        likes: [String],
        dislikes: [String],
        parent_id: String,
        reply_type: String
    }

    type RepliesPreview {
        id: String,
        count: Int,
        recent: [Reply]
    }
    
    type Post {
        id: ID,
        author: Author, 
        title: String,
        body: String,
        type: String,
        attachments: [Attachment],
        likes: [String],
        dislikes: [String],
        shares: [String],
        interest: String,
        country_code: Int,
        createdAt: String,
        updatedAt: String,
        replies: RepliesPreview,
        replies_count: Int,
        interests: [String],
        topics: [String],
        longitude: Float,
        latitude: Float,
        location_name: String,
        index_type: String,
        index: Int,
        hls_urls: [String]
    }

    type Source {
      id: String,
      name: String
    }

    type Feed {
      source: Source,
      author: String,
      title: String,
      description: String,
      url: String,
      urlToImage: String,
      publishedAt: String,
      content: String
    }

    type NewsFeed {
      status: String,
      totalResults:Int,
      articles: [Feed]
    }

    type getPostByIDType {
        replies: [Reply],
        post: [Post],
        len: Int
    }

    type getPostRepliesType {
        children: [Reply],
        parent: Reply
    }

    input schedule {
        startTime: String,
        endTime: String,
        Repeat: String
    }

    type schduleType  {
        startTime: String,
        endTime: String,
        Repeat: String
    }

    type UserProfile {
        id: String,
        first_name: String,
        last_name: String,
        alias: String,
        location: String,
        profile_photo_url: String,
        interests: [UserInterest],
        anonymous: Boolean,
        subscriptions: [UserSubscription],
        following: [UserRef],
        followers: [UserRef],
        date: String,
        status:Boolean,
        last_active: String
    }

    type Comment {
      id: ID,
        post_id: String,
        news_id: String,
        parent_comment_id: String,
        comment: String,
        content_type: String,
        likes: [String],
        data: String,
        level: String,
        author: User,
        comment_type: String,
        createdAt: String,
    }


    type FullComment{
        id: ID,
        post_id: String,
        news_id: String,
        parent_comment_id: String,
        comment: String,
        content_type: String,
        likes: [String],
        data: String,
        level: String,
        author: User,
        comment_type: String,
        createdAt: String,
        replyComments: [Comment]
    }
    type LikeResults{
        likes:[String]
    }

    type Log {
        type: String,
        message: String
    }

    type Report {
        id: String,
        code: Int,
        content_type: String,
        content_author: Author,
        content_data: String,
        author: Author,
        logs: [Log],
        description: String
    }

    type HomeFeed {
        posts: [Post],
        rooms: [Room]
    }

    type Reaction {
        emoji: String,
        author: String,
        createdAt: String
    }

    type Conversation {
        id: String,
        participants: [UserPublic],
        createdAt: String,
        last_message: String,
        last_message_from: UserPublic,
        last_message_time: String,
        archived: Boolean,
        title: String,
        custom_title: Boolean,
        updatedAt: String
    }

    type Contact {
        id: String,
        userId: String,
        info: UserPublic,
        createdAt: String
    }

    type Query {
        userProfile(id: ID!): UserProfile,
        users: [User],
        viewer: User!,
        alerts(type: String, read: Boolean, since: String): [Alert],
        user(id: ID!): User,
        interests(category: String, forum: String, search: String, only: String): [Interest],
        interest(slug: String!): Interest,
        rooms(start_at: Int, limit: Int, search: String, sort: String, interest: String): [Room],
        getNewRooms(start_at: Int, limit: Int, search: String, sort: String, interest: String, last_checked: String): [Room],
        getRoom(id: String!): Room,
        getPostByID(post_id: String!, sort: String): getPostByIDType,
        getPostsByAuthor(author: String!, sort: String, limit: Int, start_at: Int, country_code: Int): [Post],
        getPostByAuthor(author: String!, sort: String, limit: Int, start_at: Int, country_code: Int): [Post],
        getPostRepliesByID(reply_id: String!, sort: String, post_id: String!): getPostRepliesType,
        
        userSearch(
            start_at: Int, 
            limit: Int, 
            sort: String,
            search: String,
            search_by: String    
        ): [UserProfile],

        getPosts(
            search: String, 
            start_at: Int, 
            limit: Int, 
            sort: String, 
            interest: String, 
            country_code: Int, 
            exclude: [String],
            author: String,
            topics: [String],
            include: [String]
        ): [Post],

        getNewsFeed(country:String): NewsFeed,

        getFeed(
            limit: Int, 
            page: Int, 
            only: String
            since: String
        ): HomeFeed,

        getComments(
            id:String!,
            comment_type:String!,
            start_at: Int, 
            limit: Int,
            sort: String
        ): [FullComment],

        aliases: [UserProfile],

        listReports(
            content_type: String,
            content_author: String,
            author: String,
            content_data: String,
            code: Int
        ): [Report]

        listContactInvites(
            limit: Int,
            page: Int
        ): [Contact]

        inbox(
            limit: Int,
            page: Int
        ): [Conversation]

        listBroadcastRequests( roomID: String!): [LineupRequest]
        listaliases: [UserProfile],
    }

    type Mutation {
        active: SuccessStatus

        inviteUser(
            phone_country_code: String!,
            phone: String!,
            first_name: String,
            last_name: String
        ): SuccessStatus

        cancelInvite(
            phone_country_code: String!,
            phone: String!
        ): SuccessStatus

        login(
            phone_country_code: String!,
            phone: String!
        ): SuccessStatus
        
        refreshJWT(
            userID: String!,
            refreshToken: String!
        ): JwtResponse

        verifyPhoneNumber(
            phone_country_code: String!,
            phone: String!, 
            code: String!
        ): JwtResponse

        startLoginFlow(
            phone: String!, 
            phone_country_code: String!
        ): LoginResponse

        register(
            first_name: String!, 
            last_name: String!,
            alias: String,
            phone_country_code: String!,
            phone: String!,
            location: String
        ): String
        
        blockUser(
            id: String!
        ): SuccessStatus!

        subscribeToInterest(
            slug: String!
        ): SuccessStatus!
        
        unsubscribeFromInterest(
            slug: String!
        ): SuccessStatus!

        roomCreate(
            title: String,
            description: String,
            interests: [String],
            template: String!
        ): Room

        closeRoom(
            id: String!
        ): Room

        roomEdit(
            id: String!,
            title: String,
            description: String,
            private: Boolean,
            audio: Boolean,
            video: Boolean,
            chat: Boolean,
            interests: [String]
        ): Room
    
        broadcast( id: String!): SuccessStatus
        leaveBroadcastQueue( roomID: String! ): SuccessStatus
        stopBroadcasting( id: String!): SuccessStatus
        manageBroadcastRequest(
            roomID: String!,
            userID:String!,
            approve:Boolean
        ):SuccessStatus
        
        inviteUserRoom(
            roomID: String!,
            userID:String!
        ):SuccessStatus

        inviteUserRoomMulti(
            roomID: String!,
            userIDs:[String]!
        ):SuccessStatus

        roomDelete(
            id: String!
        ): SuccessStatus!
        
        joinRoomAndsubscribe(id: String!): SuccessStatus!

        leaveRoom(id: String!): SuccessStatus

        roomActions(
            roomID: String!,
            participant: String!,
            method: String!
        ): SuccessStatus!
        
        sendRoomReaction (
            roomId: String!,
            emoji: String!
        ): SuccessStatus!
        
        subscribeToRoom(
            id: String!
        ): SuccessStatus!

        unsubscribeFromRoom(
            id: String
        ): SuccessStatus!

        postCreate(
            title: String!,
            body: String!,
            type: String!,
            interest: String,
            country_code: Int,
            attachments: String,
            topics: [String],
            longitude: Float,
            latitude: Float,
            location_name: String
        ): Post
        
        hidePost(
            id: String
        ): SuccessStatus!

        replyCreate(
            message: String!,
            reply: String,
            post: String!
        ): Reply

        postActions(
            postID: String!,
            method: String!
        ): PostActionsSuccess!
        replyActions(
            replyID: String!,
            method: String!
        ): PostActionsSuccess!

        updateUser(
            first_name: String,
            profile_photo_url: String,
            last_name: String,
            alias: String,
            location: String,
            anonymous: Boolean,
            email: String
        ): User

        updateEmail(
            email: String!
        ): SuccessStatus

        verifyEmail(
            email: String!,
            code: String!
        ): SuccessStatus
        
        postEdit(
            postID: String,
            title: String,
            body: String,
            type: String,
            interest: String,
            country_code: Int
        ): Post

        postDelete(
            postID: String
        ): SuccessStatus

        followUser(
            userID: String!
        ): SuccessStatus!

        unfollowUser(
            userID: String!
        ): SuccessStatus!

        # add Comment
        postComment(
            post_id: String, 
            news_id: String,
            comment: String,
            content_type: String,
            data: String,
            level: String,
            parent_comment_id: String,
            comment_type: String
        ): Comment
        createAlias(
            alias: String!,
            first_name: String!,
            last_name: String,
            profile_photo_url: String,
            phone_country_code: Int
        ): SuccessStatus!

        commentLike(
            comment_id: String!,
            status:Boolean!
        ):LikeResults
        
        editAlias(
            id: String!,
            alias: String,
            first_name: String,
            last_name: String,
            profile_photo_url: String,
            phone_country_code: Int,
            status:Boolean
        ): User
        
        deleteAlias(
            id: String!
        ): SuccessStatus!

        createAliasToken(
            id: String!
        ): JwtResponse!

        logout: SuccessStatus!

        readAlert(
            id: String!
        ): SuccessStatus

        tipUser(
            userID: String!,
            amount: Float
        ): SuccessStatus!

        sendRoomComment(
            roomID: String!,
            message: String!
        ): SuccessStatus!

        removeRoomComment(
            roomID: String!,
            messageID: String!
        ): SuccessStatus!

        reportPost(
            postID: String!,
            code: Int,
            description: String!
        ): SuccessStatus!

        reportPostComment(
            postID: String!
            commentID: String!,
            code: Int,
            description: String!
        ): SuccessStatus!
        
        reportUser(
            userID: String!,
            code: Int,
            description: String!
        ): SuccessStatus!

        reportRoom(
            roomID: String!,
            code: Int,
            description: String!
        ): SuccessStatus!

        reportRoomComment(
            roomID: String!,
            commentID: String!,
            code: Int,
            description: String!
        ): SuccessStatus! 

        sendEmailLoginCode(
            email: String!
        ): SuccessStatus

        isBlocked(
            type: String!,
            id: String!
        ): SuccessStatus! 

        verifyEmailLoginCode(
            email: String!,
            code: String!
        ): JwtResponse!

        inviteContact(
            userID: String
        ): SuccessStatus!

        acceptContactInvite(id: String!): SuccessStatus!
        rejectContactInvite(id: String!): SuccessStatus!
        cancelContactInvite(id: String!): SuccessStatus!

        createConversation(
            recipients: [String]!
        ): Conversation!
        
        createDirectMessage(
            conversationId: String!,
            message: String,
            attachments: [String],
            type: String,
            mentions: [String]
        ): SuccessStatus!

        leaveConversation(id: String!): SuccessStatus!
        deleteDirectMessage(
            conversationId: String!,
            messageId: String!
        ): SuccessStatus!

        readConversation(
            id: String!
        ): SuccessStatus

        archiveConversation(
            id: String!
        ): SuccessStatus

        unarchiveConversation(
            id: String!
        ): SuccessStatus

        guestLogin(
            deviceID: String!,
        ):  JwtResponse

        testAlert: SuccessStatus

        phoneContactUsers(
          contacts: [String]!,
        ): [User]
    }

    type RoomSubscription {
        event: String,
        room: Room,
        participant: Participant
    }

    type Subscription {
        RoomUpdated(id: String!): RoomSubscription
        RoomListUpdates(rooms: [String]): RoomSubscription
        
        RoomParticipantJoined(id: String!): UserProfile
        RoomParticipantLeft(id: String!): UserProfile
        Notifications: Alert
    }
`;