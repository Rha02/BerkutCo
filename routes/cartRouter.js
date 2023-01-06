const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const User = require('../models/user')
const { validationResult, checkSchema } = require("express-validator")
const jwt = require('jsonwebtoken')
const http = require('../utils/http')

// Handle requests to "/cart"
router.route('/:user_id')
    // Return a list of products in the user's cart on a GET request to "/cart"
    .get(async (req, res) => {
        const token = req.header('Authorization')
        if (!token) {
            return res.status(http.statusUnauthorized).json({
                errors: [{ msg: "Unauthenticated" }]
            })
        }

        let u = undefined
        try {
            u = jwt.verify(token, process.env.SECRET_TOKEN)
        } catch (err) {
            return res.status(http.statusUnauthorized).json({
                errors: [{ msg: "Invalid authentication token" }]
            })
        }
        
        const currUser = await User.findOne({_id: u._id})
        const user = await User.findOne({_id: req.params.user_id})
        if (!currUser) {
            return res.status(http.statusBadRequest).json({
                errors: [{ msg: "Invalid authentication token" }]
            })
        }
        if (!user) {
            return res.status(http.statusNotFound).json({
                errors: [{ msg: "Invalid user id" }]
            })
        }
        if (currUser._id.toString() != user._id.toString() && currUser.access_level < 2) {
            return res.status(http.statusForbidden).json({
                errors: [{ msg: "User is unauthorized to access this resource" }]
            })
        }

        try {
            const products = await Product.find({_id: {$in: user.cart}})
            res.json(products)
        }
        catch (err) {
            res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })
    // Add a product to the user's cart on a POST request to "/cart"
    .post(async (req, res) => {
        const token = req.header('Authorization')
        if (!token) {
            return res.status(http.statusUnauthorized).json({
                errors: [{ msg: "Unauthenticated" }]
            })
        }

        let u = undefined
        try {
            u = jwt.verify(token, process.env.SECRET_TOKEN)
        } catch (err) {
            return res.status(http.statusUnauthorized).json({
                errors: [{ msg: "Invalid authentication token" }]
            })
        }
        
        const currUser = await User.findOne({_id: u._id})
        const user = await User.findOne({_id: req.params.user_id})
        if (!currUser) {
            return res.status(http.statusBadRequest).json({
                errors: [{ msg: "Invalid authentication token" }]
            })
        }
        if (!user) {
            return res.status(http.statusNotFound).json({
                errors: [{ msg: "Invalid user id" }]
            })
        }
        if (currUser._id.toString() != user._id.toString() && currUser.access_level < 2) {
            return res.status(http.statusForbidden).json({
                errors: [{ msg: "User is unauthorized to access this resource" }]
            })
        }

        try {
            const product = await Product.findOne({_id: req.body.product_id})
            if (!product) {
                return res.status(http.statusNotFound).json({
                    errors: [{ msg: "Invalid product id" }]
                })
            }
            // Add the product to the user's cart
            user.cart.push(req.body.product_id)
            await user.save()
            res.json({ msg: "Product added to cart" })
        } catch(err) {
            res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })

router.route('/:user_id/:product_id')
    // Remove a product from the user's cart on a DELETE request to "/cart"
    .delete(async (req, res) => {
        const token = req.header('Authorization')
        if (!token) {
            return res.status(http.statusUnauthorized).json({
                errors: [{ msg: "Unauthenticated" }]
            })
        }

        let u = undefined
        try {
            u = jwt.verify(token, process.env.SECRET_TOKEN)
        } catch (err) {
            return res.status(http.statusUnauthorized).json({
                errors: [{ msg: "Invalid authentication token" }]
            })
        }

        const currUser = await User.findOne({_id: u._id})
        const user = await User.findOne({_id: req.params.user_id})
        if (!currUser) {
            return res.status(http.statusBadRequest).json({
                errors: [{ msg: "Invalid authentication token" }]
            })
        }
        if (!user) {
            return res.status(http.statusNotFound).json({
                errors: [{ msg: "Invalid user id" }]
            })
        }

        if (currUser._id.toString() != user._id.toString() && currUser.access_level < 2) {
            return res.status(http.statusForbidden).json({
                errors: [{ msg: "User is unauthorized to access this resource" }]
            })
        }

        try {
            const product = await Product({_id: req.params.product_id})
            if (!product) {
                return res.status(http.statusBadRequest).json({
                    errors: [{ msg: "Invalid product id" }]
                })
            }

            let found = false
            user.cart = user.cart.filter(p => {
                found = found || p.toString() == req.params.product_id
                return p != req.params.product_id
            })
            if (!found) {
                return res.status(http.statusNotFound).json({
                    errors: [{ msg: "Product not in cart" }]
                })
            }
            await user.save()
            res.json({ msg: "Product removed from cart" })
        } catch(err) {
            res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })

module.exports = router