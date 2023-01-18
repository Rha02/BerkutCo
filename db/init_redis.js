// build redis singleton
const redis = require("redis")

// Connect to Redis
const redisClient = redis.createClient()

redisClient.connect()

module.exports = redisClient