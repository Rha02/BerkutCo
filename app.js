const express = require("express")
const app = express()
const cors = require('cors')

require("dotenv/config")

app.use(cors())
app.use(express.static("public"))
app.use(express.json())

// Routes
const router = require("./routes/router.js")
app.use("/", router)

module.exports = app