const express = require('express')
const http = require('http')
const https = require('https')
const apollo = require('apollo-server-express')
const ApolloServer = apollo.ApolloServer
const PubSub = apollo.PubSub
const resolvers = require('./resolvers')
const typeDefs = require('./typeDefs')
const mongoose = require('mongoose')
const dbEnv = require('./mongodb.env')
const expressJwt = require('express-jwt')
const cors = require('cors')
const pubsub = new PubSub()
const algoliasearch = require('algoliasearch')
const versions = require('./versions.json')

const node_env = process.env.NODE_ENV
const client = algoliasearch(process.env.ALGOLIA_CLIENT, process.env.ALGOLIA_SECRET);

const User = require('./models/User.model')
const Room = require('./models/Room.model')

const indices = {
    posts: (node_env !== "production") ? client.initIndex("dev_posts") : client.initIndex("prod_posts"),
    rooms: (node_env !== "production") ? client.initIndex("dev_rooms") : client.initIndex("prod_rooms"),
    usersProfile: (node_env !== "production") ? client.initIndex("dev_user_profiles") : client.initIndex("prod_user_profiles"),
    interests: (node_env !== "production") ? client.initIndex("dev_interests") : client.initIndex("prod_interests")
}

console.log("ENV", node_env)
const version = process.env.VERSION

const app = express();
// Connect to db
mongoose.connect(dbEnv, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true, 
    useCreateIndex: true 
}).then(() => {

const db = mongoose.connection;

const server = new ApolloServer({
    playground: true,
    introspection: true,
    typeDefs,
    subscriptions: {
        onConnect: (connectionParams, websocket, context) => {
            // console.log('onConnect context', context)
            console.log('connectionParams', connectionParams)

           return true;
        },
        onDisconnect: (websocket, context) => {
            console.log('onDisconnect context', context)
            //console.log('onDisconnect websocket', websocket)
            return true;
        },
        path: '/subscriptions'
    },
    resolvers,
    context: (params) => {
        const { req, res } = params
        let user = null
        if (req) {
            user = req.user;
        }
    
        //return res.status(400).send("Unauthorized")
        return { req, user, pubsub, indices };
    }
})

const proxyServer = http.createServer((clientReq, clientRes) => {
    // parsing
    // frame request
    // console.log('req headers', clientReq.headers)
    //console.log('client protocol', clientReq)
    let baseURL = (clientReq.protocol || 'http') + '://' + clientReq.headers.host + '/';
    // console.log('baseURL', baseURL)
    const requestToFulfill = new URL(clientReq.url, baseURL)
    // console.log('requestToFulfill', requestToFulfill)
    const options = {
        method: clientReq.method,
        headers: clientReq.headers,
        host: requestToFulfill.hostname,
        port: 8342,
        path: requestToFulfill.pathname
    }

    let api_version = clientReq.headers['x-api-version']
   
    if (!api_version) {
        if (node_env !== "production") {
            api_version = version
        } else {
            api_version = 'stable'
        }
    }

    if (api_version == 'latest') {
        api_version = version
    }

    if (api_version !== version) {
        if (versions[api_version]) {
            options.host = versions[api_version]
            options.port = 443
            options.headers.host = versions[api_version]
        }
    } else {
        // Make sure we don't have an endless loop
        options.host = 'localhost'
    }
    // console.log('options', options)
    console.log(`[${api_version}] ${options.method} : ${options.host}${options.path}`)
    console.log(`accessing port: ${options.port}`)
    delete clientReq.headers['x-api-version']
    delete options.headers['x-api-version']
    executeRequest(options, clientReq, clientRes)
})

const executeRequest = (options, clientReq, clientRes) => {
    let request = http
    if (options.port == 443) {
        request = https
    }

    // console.log('received options', options)
    // console.log('received clientReq', clientReq)
    const externalRequest = request.request(options, (externalResponse) => {
        clientRes.writeHead(externalResponse.statusCode, externalResponse.headers)

        externalResponse.on('data', (chunk) => {
            clientRes.write(chunk)
        })

        externalResponse.on('end', () => {
            clientRes.end()
        })
    })

    // console.log('externalRequest', externalRequest)
    clientReq.on('end', () => {
        externalRequest.end()
    })

    clientReq.on('data', (chunk) => {
        externalRequest.write(chunk)
    })
}

proxyServer.listen(8342, () => {
    console.log('Proxy server listening at port 8340')
})

server
    .start()
    .then((instance) => {
        app.use(cors())
        app.use(express.json())
        
        console.log('connecting to mongodb server')

    
        app.use(
            expressJwt({
                secret: process.env.JWT_SECRET,
                algorithms: ["HS256"],
                credentialsRequired: false,
                getToken: function fromHeaderOrQuerystring (req) {
                    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
                        return req.headers.authorization.split(' ')[1];
                    } else if (req.query && req.query.token) {
                        return req.query.token;
                    }
                    return null;
                    }
            })
        );

        const userRoute = require('./routes/user')
        const IndexRoute = require('./routes/index')
        const alertRoute = require('./routes/alerts')
        const botsRoute = require('./routes/bot')
        const mediaRoute = require('./routes/media')
        const functionsRoute = require('./routes/functions')
        const adminUsersRoute = require('./routes/admin/users')
        const adminReportsRoute = require('./routes/admin/reports')
        const analyticsRoute = require('./routes/analytics')
        app.set('view engine', 'ejs')
        app.use(express.static('dist'))

        app.use('/', IndexRoute)
        app.use('/user', userRoute)
        app.use('/alerts', alertRoute)
        app.use('/bot', botsRoute)
        app.use('/media',mediaRoute)
        app.use('/function', functionsRoute)
        app.use('/admin/users', adminUsersRoute)
        app.use('/admin/reports', adminReportsRoute)
        app.use('/analytics', analyticsRoute)
        
        db.once('open', ()=>{
            console.log('Connected to mongo');
        })

        db.on('error', (error)=>{
            console.log("error", error);
            throw error;
        })

        server.applyMiddleware({ app })
        const httpServer = http.createServer(app)
        server.installSubscriptionHandlers(httpServer)

        httpServer.listen(8340, () => {
            console.log(`Server up and running at http://localhost:8342${server.graphqlPath}`)
        });
    })
})