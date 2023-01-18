const app = require("./app")
const mongoose = require('mongoose')
const redisClient = require('./db/init_redis')

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