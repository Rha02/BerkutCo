

module.exports = {
    /**
     * AUTH_TOKEN_TTL is the time to live for the JWT auth token
     * @type {Number} in seconds
     */
    AUTH_TOKEN_TTL: 60 * 60 * 24,

    /**
     * TEST_MONGO_URI is the URI for the test database
     * @type {String}
     * @default 'mongodb://localhost:27017/test'
     */
    TEST_MONGO_URI: 'mongodb://localhost:27017/test',

    /**
     * TEST_REDIS_HOST is the host for the redis server
     * @type {String}
     * @default 'localhost'
     */
    TEST_REDIS_HOST: 'localhost',

    /**
     * TEST_REDIS_PORT is the port for the redis server
     * @type {Number}
     * @default 6379
     */
    TEST_REDIS_PORT: 6379,
}