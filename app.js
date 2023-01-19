const express = require("express")
const app = express()
const cors = require('cors')
const redis = require("redis")
const mongoose = require('mongoose')

require("dotenv/config")

// Connect to Redis
const redisClient = redis.createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    password: process.env.REDIS_KEY
})
redisClient.on("error", err => {
    console.error(`Error connecting to Redis: ${err}`)
    process.exitCode = 1
}).on("connect", () => {
    console.log("Connected to Redis")
})
redisClient.connect()

app.set("redisClient", redisClient)

app.use(cors())
app.use(express.static("public"))
app.use(express.json())

// Routes
const router = require("./routes/router.js")
app.use("/", router)

// Connect to DB
mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log("Connected to MongoDB")
    })
    .catch(err => {
        console.error(`Error connecting to MongoDB: ${err}`)
        process.exitCode = 1
    })

app.listen(process.env.PORT || 3000, () => console.log('Server up and running'))

// on close, disconnect from db
process.on('SIGINT', async () => {
    await mongoose.connection.close()
    console.log("Disconnected from MongoDB")
    await redisClient.quit()
    console.log("Disconnected from Redis")
})