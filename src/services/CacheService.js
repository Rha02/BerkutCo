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
    redisClient = redis.createClient(
        `redis://${options.host}:${options.port}`, 
        { password: options.password, connect_timeout: 1000 }
    )
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
     * checkIfAuthUserExists() checks if the auth session exists for a user. 
     * The auth session exists if the `token` or `userId` keys exists in redis
     * @param {String} token
     * @param {String} userId
     * @returns {Promise} Promise object represents true if the auth session exists, false otherwise
     * @throws {Error} if there is an error checking if the auth session exists
     */
    checkIfAuthUserExists: async (token, userId) => {
        return Promise.all([
            redisClient.exists(token),
            redisClient.exists(userId)
        ]).then((results) => {
            return Boolean(results[0] || results[1])
        }).catch((err) => {
            console.log(err)
        })
    },

    /**
     * saveAuthUser() saves the user data for a user to redis
     * @param {String} token
     * @param {Object} user the user data to save. Must contain the _id property
     * @param {Number} expiresIn the number of seconds the token will expire in. Default is 12 hours
     * @returns {Promise} Promise object represents the user data for the user
     */
    saveAuthUser: async (token, user, expiresIn = 60 * 60 * 12) => {
        return Promise.all([
            redisClient.set(token, JSON.stringify(user), 'EX', expiresIn),
            redisClient.set(user._id.toString(), token, 'EX', expiresIn)
        ]).catch((err) => {
            console.log(err)
        })
    },

    /**
     * deleteAuthUser() deletes the user data for a user from redis
     * @param {String} token
     * @param {String} userId
     * @returns {Promise} Promise object represents the user data for the user
     */
    deleteAuthUser: async (token, userId) => {
        return Promise.all([
            redisClient.del(token),
            redisClient.del(userId)
        ]).catch((err) => {
            console.log(err)
        })
    }
}