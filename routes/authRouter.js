const express = require("express")
const router = express.Router()
const User = require("../models/user")
const bcrypt = require("bcrypt")
const jwt = require('jsonwebtoken')
const { validationResult, checkSchema } = require("express-validator")
const {loginSchema, registerSchema} = require('../middleware/authSchema')
const http = require("../utils/http")


router.post("/login", checkSchema(loginSchema), async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(http.statusBadRequest).json({ errors: errors.array() })
    }

    try {
        const user = await User.findOne({
            email: req.body.email
        })

        if (!user) {
            return res.status(http.statusNotFound).json({
                errors: [{ msg: "User not found" }]
            })
        }

        passwordsMatch = await bcrypt.compare(req.body.password, user.password)
        if (!passwordsMatch) {
            return res.status(http.statusUnauthorized).json({
                errors: [{ msg: "Invalid credentials" }]
            })
        }
        
        const token = jwt.sign({ _id: user._id }, process.env.SECRET_TOKEN, { expiresIn: '7d' })
        
        res.setHeader("Authorization", token).json({
            errors: []
        })
    } catch(err) {
        res.status(http.statusInternalServerError).json({
            errors: [{ msg: "Unexpected error encountered" }]
        })
    }
})

router.post("/register", checkSchema(registerSchema), async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(http.statusBadRequest).json(errors.array())
    }

    try {
        const emailExists = await User.findOne({ email: req.body.email })
        if (emailExists) {
            return res.status(http.statusBadRequest).json({
                errors: [{ msg: "Email already in use" }]
            })
        }

        const usernameExists = await User.findOne({ username: req.body.username })
        if (usernameExists) {
            return res.status(http.statusBadRequest).json({
                errors: [{ msg: "Username already in use" }]
            })
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10)
        const user = new User({
            email: req.body.email,
            password: hashedPassword,
            username: req.body.username
        })

        const savedUser = await user.save()
        return res.status(http.statusCreated).json({ user_id: savedUser._id, errors: [] })
    } catch (err) {
        return res.status(http.statusInternalServerError).json({
            errors: [{ msg: "Unexpected error encountered" }]
        })
    }
})

router.get("/checkauth", async (req, res) => {
    const token = req.header('Authorization')
    if (!token) {
        return res.status(http.statusUnauthorized).json({
            errors: [{ msg: "Unauthenticated" }]
        })
    }

    let u = undefined
    try {
        u = jwt.verify(token, process.env.SECRET_TOKEN)
    } catch(err) {
        return res.status(http.statusUnauthorized).json({
            errors: [{ msg: "Invalid authentication token" }]
        })
    }

    try {
        const user = await User.findById({ _id: u._id })
        if (!user) {
            return res.status(http.statusNotFound).json({
                errors: [{ msg: "Invalid authentication token" }]
            })
        }

        return res.json({
            email: user.email,
            username: user.username
        })
    } catch(err) {
        return res.status(http.statusInternalServerError).json({
            errors: [{ msg: "Unexpected error encountered" }]
        })
    }
})

module.exports = router