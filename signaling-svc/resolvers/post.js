const apollo = require('apollo-server-express');

const Post = require('../models/Post.model');
const User = require('../models/User.model');
const Reply = require('../models/Reply.model');
const Media = require('../schemas/Media.schema')

const helpers = require('../helpers');
const tokenHelper = require('../helpers/tokens.helper')

const UserInputError = apollo.UserInputError;
const { 
    sendAlerts,
    sendOneAlert
} = require('../helpers/alerts.helper')

const { 
    toTimestamp
} = helpers

module.exports.schema = {
    id: parent => {
        return parent._id
    },
    createdAt: parent => {
        return toTimestamp(parent.createdAt)
    },
    updatedAt: parent => {
        return toTimestamp(parent.updatedAt)
    },
    replies: async parent => {
        return parent._id
    },
    topics: async parent => {
        let data = await Post.findOne({ _id: parent._id })
        if (data) {
            if (data['interests']) {
                return data['interests']
            } else {
                let returnThis = []
                if (data['interest']) {
                    returnThis.push(data['interest'])
                }
                return returnThis
            }
        }
    },
    longitude: async parent => {
        return parent.geo_longitude
    },
    latitude: async parent => {
        return parent.geo_latitude
    },
    location_name: async parent => {
        return parent.geo_title
    },
    hls_urls: async parent => {
        // Let's find out if there's a video attachment for this
        const regex = /amazonaws.com\/(.*).mp4/gm;
        let urls = []
        if (parent.attachments.length > 0) {
            parent.attachments.forEach((attachment, i) => {
                if (attachment.type == "video") {
                    let m;

                    while ((m = regex.exec(attachment.data)) !== null) {
                        // This is necessary to avoid infinite loops with zero-width matches
                        if (m.index === regex.lastIndex) {
                            regex.lastIndex++;
                        }
                        
                        // The result can be accessed through the `m`-variable.
                        m.forEach((match, groupIndex) => {
                          //  urls.push(match)
                            console.log(`Found match, group ${groupIndex}: ${match}`);
                        });
                        let key = m[1]
                        urls.push(`https://d3d64e21yhaw7d.cloudfront.net/${key}/hls/${key}.m3u8`)
                    }
                }
            })
        }

        return urls
    }
}
module.exports.reply = async (parent, params, { user }) => {
    let {
        message, 
        post, 
        reply, 
        reply_as
    } = params

    let author = await User.findOne({ _id: user.sub })
    if (author) {
        if (reply_as) {
            let as_author = await User.findOne({ 
                _id: reply_as,
                alias_owner: user.sub
            })

            // then we reply as this author
            if (as_author) {
                author = as_author;
            }
        }
    } else {
        return new UserInputError("Not authenticated.")
    }

    let data = {
        post: post,
        author: user.sub,
        message: message
    }
    reply_create = new Reply(data)
    const output = await Post.findOne( { _id: post })
    .then( async (_post) => {
        if(reply) {
                const output = await Reply.findOne( { _id: reply })
                .then( async (parent) => {
                    parent.children.push(reply_create._id)
                    reply_create.parent_id = parent._id;
                    reply_create.reply_type = "reply";
                    const saveReply = await parent.save()
                    .then(async (saved_parent) => {
                        console.log('parent saved');
                        let replyData = await reply_create.save()
                        .then(async (saveData) => {
                            console.log('saveData', saveData);
                            // let granted = await tokenHelper.grantTokens(user.sub, 'reply')
                            // console.log('granted', granted)
                            return saveData;
                        })
                        .catch((err) => {
                            console.log('error creating reply', err);
                            return new UserInputError(err);
                        })
                        return replyData;
                    })
                    .catch((err) => {
                        console.error(err);
                        return new UserInputError('Could not ');
                    })
                    return saveReply;
                }).catch((err) => {
                    console.error('Error', err);
                    throw new UserInputError('Something went wrong while fetching post data.');
                })       
                return output;

        } else {
            console.log('reply', reply);
            reply_create.parent_id = '0';
            reply_create.reply_type = "post";
            let replyData = await reply_create.save()
            .then((saveData) => {
                console.log('saveData', saveData);
                return saveData;
            })
            .catch((err) => {
                console.log('error creating post', err);
                return new UserInputError(err);
            })
            return replyData;
        }
    }).catch((err) => {
        console.error('Error', err);
        throw new UserInputError('Something went wrong while fetching post data.');
    })       
    return reply_create;
}

module.exports.create = async (parent, params, { user, indices }) => {
    let { 
        title,  
        body, 
        type, 
        interest, 
        country_code,
        attachments,
        post_as,
        topics,
        longitude,
        latitude,
        location_name
    } = params
    let author = await User.findOne({ _id: user.sub })
    if (author) {
        if (post_as) {
            let as_author = await User.findOne({ 
                _id: post_as,
                alias_owner: user.sub
            })

            // then we reply as this author
            if (as_author) {
                author = as_author;
            }
        }
    } else {
        return new UserInputError("Not authenticated.")
    }

    let { posts } = indices;

    attachmentsArr = [];
    let post_create
    let data = {
        title,
        author: author['_id'],
        body,
        type,
        attachments: [],
        interests: topics,
        geo_longitude: longitude,
        geo_latitude: latitude,
        geo_title: location_name
    };

    const runThis = () => {
        return new Promise(async (resolve, reject) => {
            if (interest) {
                let interestExists = await helpers
                    .checkIfInterestExists(interest)
                    .then(() => {
                        data['interest'] = interest;
                    })
                    .catch(err => {
                        let rr =  new UserInputError(err);
                        reject(rr)
                    })
            }
            let tmp_interests = []
            let new_interests = []
            if (topics) {
                if (topics.length > 5) {
                    throw new UserInputError("Maximum number of interests is 5.")
                }
                topics.forEach(intrest => {
                    tmp_interests.push(helpers
                        .checkIfInterestExists(intrest))
                })
                
                tmp_interests = await Promise.all(tmp_interests)
                    .then((itr) => {
                        console.log('pushed interest', itr)
                        itr.forEach(d => {
                            if (!d) {
                                throw new UserInputError("An invalid topic was given")
                            } else {
                                new_interests.push(d['slug'])
                            }
                        })
                        return itr
                    })
                    .catch(err => {
                        let rr = new UserInputError(err)
                        reject(rr)
                    })
            } else {
                if (interest) {
                    new_interests.push(interest)
                }
            }
            data.interests = new_interests

            console.log('data', new_interests, data)
        
            if (country_code) {
                data['country_code'] = parseInt(country_code);
            }
            console.log('attachments', attachments)
            if (attachments) {
                let ats = attachments.split(',')
            
                ats.forEach((attachment) => {
                    let attachment_data = attachment.split(';')
                    console.log('attachment', attachment_data)
                    if (attachment_data[1]) { // make sure we have data
                        data.attachments.push({
                            author: author['_id'],
                            type: attachment_data[0],
                            data: attachment_data[1]
                        })
                    }
                })
            }

            post_create = new Post(data)
        
            let postData = await post_create.save()
                .then(async (saveData) => {
                    let saveIndex = await posts.saveObject({
                        objectID: saveData._id,
                        ...saveData._doc
                    })
                  if (attachments) {
                        let ats = attachments.split(',')
                        ats.forEach((attachment) => {
                            let attachment_data = attachment.split(';')
                                 const newData = {}
                                newData['postID'] = saveData._id
                                console.log(newData['postID'] + "     " + attachment_data[1])
                               let  media_update =  Media.findOneAndUpdate({
                                    media_url: attachment_data[1]
                                },
                                newData,
                                {
                                    upsert: false,
                                    useFindAndModify: false
                                },
                                async ( err, doc ) => {
                                    if (err) {
                                        console.log(err)
                                    } else {
                                        return  doc;
                                    }
                                }
                                )
                        })
                    }
                    console.log('saveIndex', saveIndex)
                    //saveData['topics'] = saveData['interests']
                    resolve(saveData);
                })
                .catch((err) => {
                    console.log('error creating post', err);
                    let r = new UserInputError(err);
                    reject(err)
                })
        })
    }

    return await runThis()
}
module.exports.edit = async (parent, attr, { user, indices }) => {
    let exists = await User.exists({ _id: user.sub });
    const { posts } = indices;
    if(!exists) {
        throw new UserInputError("User does not exist");
    } else {
        if (!attr.postID) {
            return new UserInputError(`PostID not supplied.`);
        } else {
            const newData = {}, allowed = ['title', 'body', 'type','interest','country_code'];
            allowed.forEach(function(val, key) {
                if(attr[val]) {
                    newData[val] = attr[val];
                }
            });
            console.log(allowed, newData, attr.postID, user.sub);

            // Lets get info about the post
            let thePost = await Post.findOne({ _id: attr.postID })
            let author = exists
            if (thePost) {
                // Who wrote this post?
                if (thePost['author'] !== exists['_id']) {
                    author = await User.findOne({ _id: thePost['author'] })
                    if (author['is_alias'] && author['alias_owner'] !== exists['_id']) {
                        return new UserInputError("Permission denied")
                    }
                }
            } else {
                return new UserInputError("Post does not exist")
            }

            return  Post.findOneAndUpdate({ 
                    _id: attr.postID, author: author['_id']
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
                    await posts.saveObject({
                        objectID: doc._id,
                        ...doc._doc
                    }, {
                        autoGenerateObjectIDIfNotExist: false
                      })
                    return doc;
                }
            )
        }

    }
}

module.exports.delete = async ( parent, { postID }, { user, indices }) => {
    let exists = await User.exists({ _id: user.sub });
    const { posts } = indices;
    if(!exists) {
        throw new UserInputError("User does not exist");
    } else {
        if (!postID) {
            return new UserInputError(`postID not supplied`);
        } else {
            // Lets make sure we have permission to delete this post
            let author = exists

            // Lets get info about the post
            let thePost = await Post.findOne({ _id: postID })
            if (thePost) {
                // Who wrote this post?
                if (thePost['author'] !== exists['_id']) {
                    // if we aren't the author, who is?
                    author = await User.findOne({ author: thePost['author'] })
                    // Ok, is that author an alias and do we own it? if not, throw error.
                    if (author['is_alias'] && author['alias_owner'] !== exists['_id']) {
                        return new UserInputError("Permission denied")
                    }
                }
            } else {
                return new UserInputError("Post does not exist")
            }

            await Post.findOneAndDelete({ 
                    _id: postID, author: author['_id']
                }, async (err, docs) => {
                    console.log('docs', docs)
                    if (err) {
                        throw new UserInputError("Error deleting post");
                    }
                    await posts.deleteObject(postID)
                }
            )

            return { success: true };
        }
    }
};

module.exports.actions = async (parent, { postID, method}, { user }) => {
    let _post, _m = "", _action = false, _obj = {};
    let author = await User.findOne({ _id: user.sub })

    switch (method) {
        case "total":
            if (postID) {
                _post = await Post.findOne({ _id: postID})
                    .then((result) => {
                        return result;
                    })
                    .catch((err) => {
                        console.error(err);
                        return false;
                    })
                if(!_post) {
                    return new UserInputError(`Post '${postID}' not found`);
                } else { 
                    return {success: true, likes: _post.likes.length, dislikes: _post.dislikes.length};
                }
            }
        case "like":
        case "dislike":
            if (postID && user.sub) {
                _post = await Post.findOne({ _id: postID})
                    .then((result) => {
                        return result;
                    })
                    .catch((err) => {
                        console.error(err);
                        return false;
                    })
                if(!_post) {
                    return new UserInputError(`Post '${postID}' not found`);
                } else { 
                    _m = (method == "like" ? "likes" : "dislikes");
                    _post[_m].forEach(function(_users, i) {
                        if(_users == user.sub) {
                            _action = true;
                            _post[_m].splice(i, 1); 
                        }
                    });
                    
                    if (_m == 'like') {
                        var alertAuthor = await User.findOne({ _id: _post['author'] })
                        let user_name = alertAuthor['is_alias'] ? alertAuthor['alias'] : `${alertAuthor['first_name']} ${alertAuthor['last_name']}`
                        var message = `${user_name} liked your post${_post['title'] ? ` "${_post['title']}".` : `.`}`  
                        let users = []
                        users.push(alertAuthor.id)
                        let sent = await sendOneAlert(alertAuthor, {
                            title: "New Like",
                            message,
                            type: "like",
                            link: `post:${post.id}`,
                            users
                        })
                    }

                    if(_action) {
                        _obj[_m] =  _post[_m]
                        const saved = await Post.updateOne({ _id: postID}, _obj)
                        .then((s) => {
                            console.log(`User `+(method == "like" ? "" : 'dis')+` has been removed from post`, s);
                            return {success: true, likes: _post.likes.length, dislikes: _post.dislikes.length};
                        })
                        .catch((err) => {
                            console.log('error', err);
                            return new UserInputError('Could not update data');
                        });
                        return saved;
                    } else {
                        _action = false;
                        _post[(_m == "dislikes" ? "likes" : "dislikes")].forEach(function(_users, i) {
                            if(_users == user.sub) {
                                _action = true;
                                _post[(_m == "dislikes" ? "likes" : "dislikes")].splice(i, 1); 
                            }
                        });
                        if(_action) {
                            _obj[(_m == "dislikes" ? "likes" : "dislikes")] =  _post[(_m == "dislikes" ? "likes" : "dislikes")]    
                        }
                        _post[_m].push(user.sub)
                        _obj[_m] =  _post[_m]
                        const saved = await Post.updateOne({ _id: postID}, _obj)
                        .then((s) => {
                            console.log(`User `+(method == "like" ? "" : 'dis')+` post`, s);
                            return {success: true, likes: _post.likes.length, dislikes: _post.dislikes.length};
                        })
                        .catch((err) => {
                            console.log('error', err);
                            return new UserInputError('Could not update data');
                        });
                        return saved;
                    }
                }
            } else {
                return new UserInputError(`Missing Post ID or User ID`);
            }            
        break;
        default: 
            return new UserInputError('Method not found');
        break;
    }
}

module.exports.reply_actions = async (parent, { replyID, method}, { user }) => {
    let _reply, _m = "", _action = false, _obj = {};
    switch (method) {
        case "total":
            if (replyID) {
                _reply = await Reply.findOne({ _id: replyID})
                    .then((result) => {
                        return result;
                    })
                    .catch((err) => {
                        console.error(err);
                        return false;
                    })
                if(!_reply) {
                    return new UserInputError(`Reply '${replyID}' not found`);
                } else { 
                    return {success: true, likes: _reply.likes.length, dislikes: _reply.dislikes.length};
                }
            }
        case "like":
        case "dislike":
            if (replyID && user.sub) {
                _reply = await Reply.findOne({ _id: replyID})
                    .then((result) => {
                        return result;
                    })
                    .catch((err) => {
                        console.error(err);
                        return false;
                    })
                if(!_reply) {
                    return new UserInputError(`Reply '${replyID}' not found`);
                } else { 
                    _m = (method == "like" ? "likes" : "dislikes");
                    _reply[_m].forEach(function(_users, i) {
                        if(_users == user.sub) {
                            _action = true;
                            _reply[_m].splice(i, 1); 
                        }
                    });
                    if(_action) {
                        _obj[_m] =  _reply[_m]
                        const saved = await Post.updateOne({ _id: postID}, _obj)
                        .then((s) => {
                            console.log(`User `+(method == "like" ? "" : 'dis')+` has been removed from reply`, s);
                            return {success: true, likes: _reply.likes.length, dislikes: _reply.dislikes.length};
                        })
                        .catch((err) => {
                            console.log('error', err);
                            return new UserInputError('Could not update data');
                        });
                        return saved;
                    } else {
                        _action = false;
                        _reply[(_m == "dislikes" ? "likes" : "dislikes")].forEach(function(_users, i) {
                            if(_users == user.sub) {
                                _action = true;
                                _reply[(_m == "dislikes" ? "likes" : "dislikes")].splice(i, 1); 
                            }
                        });
                        if(_action) {
                            _obj[(_m == "dislikes" ? "likes" : "dislikes")] =  _reply[(_m == "dislikes" ? "likes" : "dislikes")]    
                        }
                        _reply[_m].push(user.sub)
                        _obj[_m] =  _reply[_m]
                        const saved = await Post.updateOne({ _id: replyID}, _obj)
                        .then((s) => {
                            console.log(`User `+(method == "like" ? "" : 'dis')+` reply`, s);
                            return {success: true, likes: _reply.likes.length, dislikes: _reply.dislikes.length};
                        })
                        .catch((err) => {
                            console.log('error', err);
                            return new UserInputError('Could not update data');
                        });
                        return saved;
                    }
                }
            } else {
                return new UserInputError(`Missing Reply ID or User ID`);
            }            
        break;
        default: 
            return new UserInputError('Method not found');
        break;
    }
}

module.exports.hide = async (parent, { id }, { user, indices }) => {
    let me = await User.findOne({ _id: user.sub })
    if (!me) {
        return new UserInputError("Not authenticated.")
    }

    let post = await Post.findOne({ _id: id })
    if (!post) {
        return new UserInputError("Post does not exist.")
    }

    let success = false;

    let blocked_users = post['blockUsers'] ? post.blockUsers : []
    if (blocked_users.length > 0) {
        let is_blocked = false
        blocked_users.forEach(usr => {
            if (usr == me.id) {
                is_blocked = true
            }
        })

        if (!is_blocked) {
            success = true
        }
    } else {
        success = true
    }

    if (success) {
        post.blockUsers.push(me.id)
        let saved = await post.save()
            .catch(err => {
                console.log('Block post errror: ', err)
                success = false
            })
        await indices.posts.saveObject({
            objectID: id,
            ...post
        })
    }

    return { success }
}