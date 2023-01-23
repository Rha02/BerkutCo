const express = require("express")
const app = express()
const cors = require('cors')
const mongoose = require('mongoose')
const cacheService = require("./src/services/CacheService")

require("dotenv/config")

// Connect to Redis
cacheService.connect({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_KEY
}).then(() => {
    console.log("Connected to Redis")
}).catch(err => {
    console.error(`Error connecting to Redis: ${err}`)
    process.exitCode = 1
})

app.use(cors())
app.use(express.static("public"))
app.use(express.json())

// Routes
const router = require("./src/routes/router.js")
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
    await cacheService.disconnect()
    console.log("Disconnected from Redis")
})