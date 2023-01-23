const redis = require('redis');

/**
 * redisClient is the redis client
 * @type {redis.RedisClientType}
 */
let redisClient = null;

/**
 * connect() connects to a redis server
 * @param {Object} options
 * @param {String} options.host
 * @param {Number} options.port
 * @param {String} options.password
 * @returns {Promise} Promise object represents the connection to the redis server
 */
const connect = (options) => {
    // create a new redis client with timout set to 1 second
    redisClient = redis.createClient({
        host: options.host,
        port: options.port,
        password: options.password
    })
    return redisClient.connect()
}

/**
 * disconnect() disconnects from a redis server
 * @returns {Promise} Promise object represents the disconnection from the redis server
 * @throws {Error} if there is an error disconnecting from redis
 * */
const disconnect = () => {
    return redisClient.quit()
}

module.exports = {
    connect: connect,
    disconnect: disconnect,

    /**
     * getAuthToken() gets the auth token for a user from redis
     * @param {String} userId
     * @returns {Promise} Promise object represents the auth token for the user
     * @throws {Error} if there is an error getting the auth token from redis
    */
    getAuthToken: (userId) => {
        return redisClient.get(userId)
    },

    /**
     * getAuthUser() gets the user data for a user from redis
     * @param {String} token
     * @returns {Promise} Promise object represents the user data for the user
     * @throws {Error} if there is an error getting the user data from redis
     */
    getAuthUser: async (token) => {
        return redisClient.get(token)
    },

    /**
     * saveAuthUser() saves the user data for a user to redis
     * @param {String} token
     * @param {Object} user
     * @returns {Promise} Promise object represents the user data for the user
     */
    saveAuthUser: async (token, user) => {
        return Promise.all([
            redisClient.set(token, JSON.stringify(user), 'EX', 60 * 60 * 24 * 7),
            redisClient.set(user._id.toString(), token, 'EX', 60 * 60 * 24 * 7)
        ]).catch((err) => {
            console.log(err)
        })
    },

    /**
     * deleteAuthUser() deletes the user data for a user from redis
     * @param {String} token
     * @param {Object} user
     * @returns {Promise} Promise object represents the user data for the user
     */
    deleteAuthUser: async (token, user) => {
        return Promise.all([
            redisClient.del(token),
            redisClient.del(user._id.toString())
        ]).catch((err) => {
            console.log(err)
        })
    }
}