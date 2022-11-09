const express = require("express")
const router = express.Router()
const User = require("../models/user")
const bcrypt = require("bcrypt")
const jwt = require('jsonwebtoken')
const { validationResult, checkSchema } = require("express-validator")
const {loginSchema, registerSchema} = require('../middleware/authSchema')

router.post("/login", checkSchema(loginSchema), async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(400).json({errors: errors.array()})
    }

    try {
        const user = await User.findOne({
            email: req.body.email
        })

        if (!user) {
            return res.status(400).json("Error: User does not exist")
        }

        passwordsMatch = await bcrypt.compare(req.body.password, user.password)
        if (!passwordsMatch) {
            return res.status(401).json("Error: Invalid credentials")
        }

        const token = jwt.sign({ _id: user._id }, process.env.SECRET_TOKEN)

        res.setHeader("auth-token", token).json(token)
    } catch(err) {
        res.status(500).json("Error: Unexpected error encountered")
    }
})

router.post("/register", checkSchema(registerSchema), async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(400).json(errors.array())
    }

    try {
        const emailExists = await User.findOne({ email: req.body.email })
        if (emailExists) {
            return res.status(400).json("Error: User with this email already exists")
        }

        const usernameExists = await User.findOne({ username: req.body.username })
        if (usernameExists) {
            return res.status(400).json("Error: User with this username already exists")
        }


        const hashedPassword = await bcrypt.hash(req.body.password, 10)
        const user = new User({
            email: req.body.email,
            password: hashedPassword,
            username: req.body.username
        })

        const savedUser = await user.save()
        res.status(201).json({ user_id: savedUser._id })
    } catch (err) {
        res.status(500).json("Error: Unexpected error encountered")
    }
})

router.get("/checkauth", async (req, res) => {
    const token = req.header('auth-token')
    if (!token) {
        return res.status(401).json("Error: Unauthenticated")
    }

    let u = undefined
    try {
        u = jwt.verify(token, process.env.SECRET_TOKEN)
    } catch(err) {
        return res.status(401).json("Error: Invalid Authentication Token")
    }
    
    const user = await User.findById({_id: u._id})
    if (!user) {
        return res.status(404).json("Error: User not found")
    }

    res.json({
        email: user.email,
        username: user.username
    })
})

module.exports = router