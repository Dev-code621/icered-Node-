const twilio = require('twilio')
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const jwt = require('jsonwebtoken');
const apollo = require('apollo-server-express');
const UserInputError = apollo.UserInputError;
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI('91a4fdc5d3aa4773983c8f421ad7fdec');

const InterestRef = require('../schemas/Interest.ref.schema');
const Interest = require('../models/Interest.model');
const Rooms = require('../resolvers/room');
const Room = require('../models/Room.model');
const Subscription = require('../schemas/Subscription.schema');

const Post = require('../resolvers/post');
const PostM = require('../models/Post.model');
const ReplyM = require('../models/Reply.model');
const User = require('../models/User.model');
const { post } = require('superagent');
const PostModel = require('../models/Post.model');
const Comment = require('../models/Comment.model')

// The getPosts method is the main method that shall be used to query posts.
const getPosts = async (parent, params, { 
    user, 
    indices 
}) => {
    let userData = await User.findOne({_id: user.sub })

    // Include the posts index from algolia
    const { posts } = indices;
    let { 
        search, 
        start_at, 
        limit, 
        sort, 
        interest, 
        country_code,
        exclude,
        author,
        topics,
        include
    } = params
    
    console.log('params', params)
    // Pre-configure defaults
    sort = (sort == "asc" ? 1 : -1);
    start_at = (!start_at ?  0 : start_at);
    limit = (!limit ?  0 : limit);
    exclude = (!exclude ? [] : exclude)
    author = (!author ? null : author)
    interest = (!interest ? 'any' : interest)
    search = (!search ? '' : search)

    // We're gonna build a filter to pass into algolia
    let filter = ""
    let filters = []

    // This function excludes rather than includes
    const filterExcludes = async () => {
        return new Promise(async (resolve, reject) => {
            if (exclude.length === 0) {
                return resolve(true)
            } else {
                exclude.map(async (exclusion, i) => {

                    // If we exclude bots, grab all bots from the database and add them to the request
                    if(exclusion == 'bots') {
                        let bots = await User.find({
                            is_bot: true
                        })
                        let bots_list = []
                        bots.forEach(bot => {
                            bots_list.push(`NOT author:${bot._id}`)
                        })

                        if (bots_list.length > 0) {
                            filters.push(`(${bots_list.join(' AND ')})`)
                        }
                    }

                    if (interest !== 'any') {
                    
                    } else {
                        if (exclusion == 'non-interests') {
                            let interests = userData['interests']
                            let interests_list = []
                            interests.forEach(interest => {
                                interests_list.push(`interest:"${interest.slug}"`)
                            })

                            if (interests_list.length > 0) {
                                filters.push(`(${interests_list.join(' OR ')})`)
                            }
                            console.log('interests', interests)
                        }
                    }

                    console.log('i', i)
                    if ((exclude.length - 1) === i) {
                        return resolve(true)
                    }
                })
            }
        })
    }

    const filterIncludes = async () => {
        return new Promise(async (resolve, reject) => {
            if (!include) {
                include = []
            }
            
            if (include.length === 0) {
                return resolve(true)
            } else {
                let include_filters = []
                include.map(async (inclusion, i) => {
                    
                    // If we exclude bots, grab all bots from the database and add them to the request
                    if(inclusion == 'me') {
                        include_filters.push(`(author: ${user.sub})`)
                    }

                    if (inclusion == 'following') {
                        let following = []
                        userData.subscriptions.forEach((sub) => {
                            if (sub.type == "user") {
                                following.push(`author:${sub.payload.get('user_id')}`)
                            }
                        })
                        if (following.length > 0) {
                            include_filters.push(`${following.join(' OR ')}`)
                        }
                    }

                    if (inclusion == 'my_interests') {
                        let my_interests = []
                        userData.interests.forEach(ntrst => {
                            my_interests.push(`interests:${ntrst.slug}`)
                        })
                        if (my_interests.length > 0) {
                            include_filters.push(`${my_interests.join(' OR ')}`)
                        }
                    }

                    console.log('i', i)
                    
                    if ((include.length - 1) == i) {
                        filters.push(`(${include_filters.join(' OR ')})`)
                        return resolve(true)
                    }
                })
            }
        })
    }
    
    // Run the filters
    let excludeThem = await filterExcludes()
    let includeThem = await filterIncludes()

    if (country_code) {
        filters.push(`(country_code:${country_code})`)
    }

    if (interest !== 'any') {
        filters.push(`(interest:"${interest}")`)
    }

    // Don't include posts that we have blocked
    filters.push(`NOT blockUsers: ${user.sub}`)

    if (topics) {
        let interests_arr = []
        topics.forEach(topic => {
            interests_arr.push(`interests:"${topic}"`)
        })
        let compiled_topics = interests_arr.join(' OR ')
        filters.push(`(${compiled_topics})`)
    }

    if (author) {
        filters.push(`(author:"${author}")`)
    }
    //console.log("aaa",`(interest:include(${interest}))`)
    filter = filters.join(' AND ')
    console.log('filter', filter)
    let results = await posts.search(search, {
        hitsPerPage: limit,
        page: start_at,
        filters: filter
    })
        
    let hits = results.hits;
    
    let result = [];
    let returnThis =  await Promise.all(hits.map(async(hit) => {
        let post = await PostModel.findOne({ _id: hit['_id']});
        if(post == null){
            
        }else{
            if (post['blockUsers'].indexOf(user.sub) > -1 ||  userData['blockUsers'].indexOf(post['author'])> -1) {
                //In the array!
                console.log("aaaaa",post['blockUsers'])
                console.log("bbbb",userData['blockUsers'])

            } else {
                let commentCount = await Comment.countDocuments({ 'post_id': hit['_id']})
                    hit['likes'] = post['likes']
                    hit['dislikes'] = post['dislikes']
                    hit['title'] = post['title']
                    hit['body'] = post['body']
                    hit['interest'] = post['interest']
                    hit['replies_count'] = commentCount   
                   // result.push(hit)     
                   return hit
            }
          
        }
    }));
    
    return returnThis
}

module.exports.getPosts = getPosts

module.exports.getPostsByAuthor = async (parent, { author, sort, limit, start_at, country_code }, { user, indices }) => {
    let results = await getPosts(parent, {
        author,
        sort,
        limit,
        start_at,
        country_code
    }, { user, indices })

    //console.log('results', results)
    return results
}

module.exports.repliesPreview = {
    id: parent => {
        return parent
    },
    count: async (parent) => {
       // console.log('parent id', parent)
        let numReplies = await ReplyM
            .countDocuments({ post: parent })
        return numReplies;
    },
    recent: async (parent) => {
        let sort = -1;
        let result = await ReplyM
            .find({ post: parent })
            .sort({"_id": sort})
            .limit(3)
            .then( async (reply) => {
                return reply;
            }).catch((err) => {
                return [];
            });
        return result;
    }
};

module.exports.getPostByID = async (parent,  { post_id, sort }, { user }) => {
    sort = (sort == "asc" ? 1 : -1);
    let result = await PostM.find({ "_id": post_id })
    .then( async (post) => {
        let _nr = await ReplyM.find({ post: post_id }).sort({"_id": sort})
        .then( async (reply) => {
            console.log("POST AND REPLIES")
            return {post: post, replies: reply, len: reply.length};
        }).catch((err) => {
            console.log("ONLY POST", err)
            return {post: post, replies: [], len: 0};
        });
        return _nr;
    }).catch((err) => {
        console.log(err);
        return new UserInputError('Error finding post');
    });       
    return result;
};

module.exports.getPostRepliesByID = async (parent,  { reply_id, post_id, sort }, { user }) => {
    sort = (sort == "asc" ? 1 : -1);
    let result = await ReplyM
        .findOne({ 
            $and: [ 
                    { _id: reply_id }, 
                    { post: post_id } 
            ]
        }).sort({
            "_id": sort
        }).then( async (parent) => {
            let result = await ReplyM.find({ $and: [ { parent_id: parent._id } , { post: post_id } ]}).sort({"_id": sort})
            .then( async (children) => {
                return {parent: parent, children: children}
            }).catch((err) => {
                console.log(err);
                return {parent: parent, children: []}
            });       
            return result;
        }).catch((err) => {
            console.log(err);
            return new UserInputError('Error finding post');
        });       
    return result;
};

module.exports.interests = async (parent, args, { user, indices }) => {
    let { 
        category, 
        forum, 
        search,
        only
    } = args;

    search = (!search ? "" : search)
    only = (!only ? false : only)

    let interestIndex = indices.interests;

    let filter = ""
    let filters = []

    let user_interests = await User.findOne({ _id: user.sub })
        .then((result) => {
            return result.interests;
        })
        .catch((err) => {
            console.error(err);
            return false;
        })

    if (!user_interests) {
       return new UserInputError('Unable to locate user.');
    }
    let interestQuery = {}
    if (category) {
        interestQuery['category'] = category;
        filters.push(`(category:"${category}")`)
    }

    if (forum) {
        filters.push(`(parents:"${forum}")`)
    }

    if (only) {
       switch(only) {
           case 'forums':
                filters.push(`(type:"forum")`)
           break;
           case 'interests':
                filters.push(`(type:"interest")`)
           break;
           default:
               // nada
       } 
    }

    filter = filters.join(' AND ')
    console.log('filter', filter)
    // let results = await interestIndex.search(search, {
    //     hitsPerPage: 1000,
    //     page: 0,
    //     filters: filter
    // })
    // let results = await Interest.find({})
    
    let interestHolder = []
    let result = await Interest.find({})
        .then((result) => {
            // console.log('results', result);
            let interests = result.forEach((subject) => {
                // console.log('subject', subject)
                subject['subscribed'] = false;
                if (user_interests.length > 0) {
                    user_interests.map((user_interest) => {
                        if (user_interest.slug === subject.slug) {
                            subject['subscribed'] = true;
                        }
                    })
                }
                subject['subscriber_count'] =  `${subject.subscribers.length}`;
                interestHolder.push(subject)
                return subject;
            });
            return interests;
        });
    // console.log('interestHolder', interestHolder)
    // let returnThis = []
    // results.forEach(hit => {
    //     console.log('the hit', hit['objectID'], interestHolder[hit['objectID']])
    //     // returnThis.push(interestHolder[hit['objectID']])
    // });
    
    return interestHolder  
};

module.exports.getInterest = async (parent, args, { user, indices }) => {
    console.log('args', args);
    let user_interests = await User.findOne({ _id: user.sub })
        .then((result) => {
            return result.interests;
        })
        .catch((err) => {
            console.error(err);
            return false;
        })

    if (!user_interests) {
        return new UserInputError('Unable to locate user.');
    }
    let result = await Interest.findOne({ slug: args.slug });

    result['subscribed'] = false;
    if (user_interests.length > 0) {
        user_interests.map((user_interest) => {
            if (user_interest.slug === args.slug) {
                result['subscribed'] = true;
            }
        })
    }

    result['subscriber_count'] = `${result.subscribers.length}`;

    return result;
};

const GetSocialCircle = user => {
    return new Promise(async (resolve, reject) => {
        let returnThis = []
        let users = {}
        let followingUsers = []

        user.subscriptions.forEach(subscription => {
            if (subscription.type == 'user') {
                let userid = subscription.payload.get('user_id')
                console.log('usesr id is', userid)
                users[userid] = true
                followingUsers.push(userid)
            }
        })

        user.followers.forEach(follower => {
            if (users[follower.user_id]) {
                returnThis.push(follower.user_id)
            }
        })

        resolve({ 
            socialCircle: returnThis, 
            followingUsers
        })
    })
};

module.exports.algorithm = async (parent, { 
    limit, 
    page, 
    country_code,
    only,
    since
}, { user, indices }) => {
    const { 
        posts, 
        rooms 
    } = indices

    page = (!page ?  0 : page)
    limit = (!limit ?  0 : limit)
    only = (!only ? false : only)

    // Lets gather all the data we need to build a feed of posts
    let userData = await User.findOne({ _id: user.sub })

    if (!userData) {
        return new UserInputError(`Not authenticated.`)
    }

    console.log('userdata', userData)
    // get subscriptions [following]
    let filters = []
    let room_filters = []
    let room_subs = []

    let following = []
    let room_following = []

    userData['subscriptions'].forEach(subscription => {
        //  console.log(subscription)
        switch (subscription.type) {
            case 'user':
                let authorIDfilter = `author:"${subscription.payload.get('user_id')}"`
                following.push(authorIDfilter)
                room_following.push(authorIDfilter)
            break;
            case 'room':
                room_subs.push(`_id:"${subscription.payload.get('room_id')}"`)
            break;
        }
    })

    // show our own posts
    following.push(`author:"${user.sub}"`);

    if (following.length > 0) {
        filters.push(`(${following.join(" OR ")})`)
    }

    // Don't include posts that we have blocked
    filters.push(`NOT blockUsers: ${user.sub}`)

    if (room_following.length > 0) {
        room_filters.push(`(${room_following.join(" OR ")})`)
    }

    if (room_subs.length > 0) {
        room_filters.push(`(${room_subs.join(" OR ")})`)
    }


    // get interests
    let interests = []
    userData['interests'].forEach( interest => {
        // console.log(interest)
        interests.push(`interest:"${interest.slug}"`)
        interests.push(`interests:"${interest.slug}"`)
    })

    if (interests.length > 0) {
        filters.push(`(${interests.join(" OR ")})`)
        room_filters.push(`(${interests.join(" OR ")})`)
    }

    let filter = filters.join(' OR ')
    let room_filter = room_filters.join(' OR ')

    // Lets bring up posts
    if (country_code) {
        filter += ` AND (country_code:${userData['country_code']})`
    }

    let sorter = []
    let returnLists = {}

    if (!only || only == 'posts' || only == 'forums') {
        returnLists['posts'] = []

        let results = await posts.search('', {
            hitsPerPage: limit,
            page: page,
            filters: filter
        })

        let postResults = results.hits
        postResults.forEach(async thePost => {
            let timestmp = new Date(thePost.createdAt)
           // console.log('post created at', timestmp.valueOf())
            thePost['index_type'] = 'post'
            thePost['timestamp'] = timestmp.valueOf()
            if (only == 'forums') {
                if (thePost['interests'].length > 0) {
                    sorter.push(thePost)
                }
            } else {
                sorter.push(thePost)
            }
        })
    }

    if (!only || only == 'rooms') {
        returnLists['rooms'] = []
        let hitLimit = 3

        if (only == 'rooms') {
            hitLimit = limit
        }
        /*
        let room_results = await rooms.search('', {
            hitsPerPage: hitLimit,
            page,
            filters: room_filter
        })
        let roomResults = room_results.hits
        roomResults.forEach(async theRoom => {
            let timestmp = new Date(theRoom.updatedAt)
           // console.log('room created at', timestmp.valueOf())
            theRoom['index_type'] = 'room'
            theRoom['timestamp'] = timestmp.valueOf()
            
            sorter.push(theRoom)
        })
        */

        // For social, we need to get an array of mutually following
        let { socialCircle, followingUsers } = await GetSocialCircle(userData)

        console.log('my social circle', socialCircle)
        let social_circle_query = []

        socialCircle.forEach(friend => {
            social_circle_query.push({
                '$and': [
                    {
                        author: friend
                    },
                    {
                        template: 'social'
                    }
                ]
            })
        })

        let following_query = []
        
        followingUsers.forEach(userid => {
            following_query.push({
                '$and': [
                    {
                        author: userid
                    },
                    {
                        template: 'social'
                    }
                ]
            })

            following_query.push({
                '$and': [
                    {
                        author: userid
                    },
                    {
                        template: 'open'
                    }
                ]
            })
        })
        
        // Exclude results with empty participants
        let findQuery = {}

        // Lets only get rooms that we are allowed to see
        findQuery['$or'] = [
            {
                '$and': [
                    {
                        template: 'open'
                    },
                    {
                        invitees: user.sub
                    }
                ]
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
                author: userData.id
            },
            {
                '$or': social_circle_query
            },
            ...following_query
        ]

      // makes sure we aren't retrieving empty rooms
        findQuery['broadcasters'] = { $exists: true, $type: 'array', $ne: [] } 

        if (since) {
            findQuery['updatedAt'] = { $gt: since }
        }

        let roomResults = await Room.find(findQuery)
            .sort({
                "updatedAt": -1
            })
            .limit(hitLimit)
            .skip(page * hitLimit)
            .then(async result => {
                await Promise.all(result.map(async (room) => {
                    let timestmp = new Date(room.updatedAt)
                    // console.log('room created at', timestmp.valueOf())
                     room['index_type'] = 'room'
                     room['timestamp'] = timestmp.valueOf()
                     
                     // Lets make sure there are no duplicates
                     let broadcasters = []
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
                     sorter.push(room)
                }))
                return result
            })
            .catch(err => {
                return new UserInputError(err)
            })
    }

    sorter.sort(function(x, y){
        console.log(x.timestamp)
        return y.timestamp - x.timestamp;
    })

    let i = 0;
     await Promise.all(sorter.map(async(item) => {
        item['index'] = i;
        switch (item.index_type) {
            case 'room':
                returnLists['rooms'].push(item)
            break;
            case 'post':
                let post = await PostModel.findOne({ _id: item['_id']});
                if(post) {
                    if (post['blockUsers'].indexOf(user.sub) > -1 ||  userData['blockUsers'].indexOf(post['author'])> -1) {
                        //In the array!
                       // console.log("aaaaa",post['blockUsers'])
                       // console.log("bbbb",userData['blockUsers'])
                    } else {
                        let commentCount = await Comment.countDocuments({ 'post_id': item['_id']})
                        item['likes'] = post['likes']
                        item['dislikes'] = post['dislikes']
                        item['title'] = post['title']
                        item['body'] = post['body']
                        item['interest'] = post['interest']
                        item['replies_count'] = commentCount   

                        returnLists['posts'].push(item) 
                    }
                }
            break;
        }
        i++;
      }));

    return returnLists
};