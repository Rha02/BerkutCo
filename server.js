const express = require("express")
const app = express()
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const cors = require('cors')

require("dotenv/config")

app.use(cors())
app.use(express.static("public"))
app.use(express.json())
app.use(bodyParser.urlencoded({ limit: '10mb', extended: false}))

// Connect to DB
mongoose.connect(process.env.DATABASE_URL)
    .then(res => {
        console.log("Connected to MongoDB")
    })
    .catch(err => {
        console.error(`Error connecting to MongoDB: ${err}`)
    })

// Routes
const router = require("./routes/router.js")
app.use("/", router)

app.listen(process.env.PORT || 3000, () => console.log('Server up and running'))