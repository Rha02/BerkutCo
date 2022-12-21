const app = require("./app")
const mongoose = require('mongoose')

// Connect to DB
mongoose.connect(process.env.DATABASE_URL)
    .then(res => {
        console.log("Connected to MongoDB")
    })
    .catch(err => {
        console.error(`Error connecting to MongoDB: ${err}`)
        process.exitCode = 1
    })

app.listen(process.env.PORT || 3000, () => console.log('Server up and running'))