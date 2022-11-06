const express = require("express")
const router = express.Router()

router.get((req, res) => {
    res.json({
        message: 'GET: /auth'
    })
})

router.post((req, res) => {
    res.json({
        message: "POST: /registration"
    })
})

module.exports = router