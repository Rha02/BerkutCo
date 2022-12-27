const express = require('express')
const router = express.Router()

// Attach subrouters
router.use("/", require('./authRouter'))
router.use("/products", require('./productRouter'))

module.exports = router