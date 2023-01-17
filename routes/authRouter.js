const express = require("express")
const router = express.Router()
const User = require("../models/user")
const bcrypt = require("bcrypt")
const jwt = require('jsonwebtoken')
const { validationResult, checkSchema } = require("express-validator")
const {loginSchema, registerSchema} = require('../validation/authSchema')
const http = require("../utils/http")
const { requiresAuthentication } = require("../middleware/auth")

// Login a user on a POST request to "/login"
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

        // Check if the password is correct
        const validPassword = await bcrypt.compare(req.body.password, user.password)
        if (!validPassword) {
            return res.status(http.statusUnauthorized).json({
                errors: [{ msg: "Invalid password" }]
            })
        }
        
        const token = jwt.sign({ _id: user._id }, process.env.SECRET_TOKEN, { expiresIn: '7d' })

        // hide the password field
        user.password = undefined
        res.setHeader("Authorization", token).json(user)
    } catch(err) {
        res.status(http.statusInternalServerError).json({
            errors: [{ msg: "Unexpected error encountered" }]
        })
    }
})

// Register a user on a POST request to "/register"
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
        return res.status(http.statusCreated).json({
            _id: savedUser._id,
            msg: "User created successfully"
        })
    } catch (err) {
        return res.status(http.statusInternalServerError).json({
            errors: [{ msg: "Unexpected error encountered" }]
        })
    }
})

// Return the currently signed-in user on a GET request to "/checkauth"
router.get("/checkauth", requiresAuthentication, async (req, res) => {
    const user = req.user
    user.password = undefined

    return res.json("SHOULD FAIL")
    return res.json(user)
})

module.exports = router