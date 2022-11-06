const express = require('express')
const router = express.Router()

router.use("/", require('./authRouter'))
router.use("/products", require('./productRouter'))

module.exports = router