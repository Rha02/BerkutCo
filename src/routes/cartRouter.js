const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const User = require('../models/user')
const { validationResult, checkSchema } = require("express-validator")
const http = require('../utils/http')
const cartSchema = require('../validation/cartSchema')
const { requiresAuthentication } = require('../middleware/auth')

// Handle requests to "/cart"
router.route('/:user_id')
    // Return a list of products in the user's cart on a GET request to "/cart"
    .get(requiresAuthentication, async (req, res) => {
        const currUser = req.user

        const user = await User.findOne({_id: req.params.user_id})
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
            const products = await Product.find({ _id: { $in: user.cart.map(p => p.product_id) } }).lean()
            for (let i = 0; i < products.length; i++) {
                products[i].quantity = user.cart[i].quantity
                products[i].image_url = `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/images/${products[i].image_name}`
            }
            res.json(products)
        }
        catch (err) {
            res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })
    // Add a product to the user's cart on a POST request to "/cart"
    .post(requiresAuthentication, checkSchema(cartSchema), async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(http.statusBadRequest).json({ errors: errors.array() })
        }

        const currUser = req.user

        const user = await User.findOne({_id: req.params.user_id})
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

            if (product.stock < req.body.quantity) {
                return res.status(http.statusBadRequest).json({
                    errors: [{ msg: "Insufficient stock" }]
                })
            }

            // Check if product is already in cart
            for (let i = 0; i < user.cart.length; i++) {
                if (user.cart[i].product_id.toString() == req.body.product_id.toString()) {
                    return res.status(http.statusBadRequest).json({
                        errors: [{ msg: "Product already in cart" }]
                    })
                }
            }

            // add product to cart
            await User.updateOne({_id: user._id}, { $push: { cart: { product_id: req.body.product_id, quantity: req.body.quantity } } })

            res.json({ msg: "Product added to cart" })
        } catch(err) {
            res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })

router.route('/:user_id/:product_id')
    // Update the quantity of the product
    .put(requiresAuthentication, checkSchema(cartSchema), async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(http.statusBadRequest).json({ errors: errors.array() })
        }

        const currUser = req.user

        const user = await User.findOne({_id: req.params.user_id})
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
            const product = await Product.findOne({_id: req.params.product_id})
            if (!product) {
                return res.status(http.statusNotFound).json({
                    errors: [{ msg: "Invalid product id" }]
                })
            }

            if (product.stock < req.body.quantity) {
                return res.status(http.statusBadRequest).json({
                    errors: [{ msg: "Insufficient stock" }]
                })
            }

            // check if product is in cart
            let found = false
            for (let i = 0; i < user.cart.length && !found; i++) {
                if (user.cart[i].product_id.toString() == req.params.product_id.toString()) {
                    await User.updateOne(
                        {_id: user._id, "cart.product_id": req.params.product_id},
                        { $set: { "cart.$.quantity": req.body.quantity } }
                    )
                    found = true
                }
            }

            if (!found) {
                return res.status(http.statusNotFound).json({
                    errors: [{ msg: "Product not in cart" }]
                })
            }

            return res.json({ msg: "Product quantity updated" })
        } catch(err) {
            res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })
    // Remove a product from the user's cart on a DELETE request to "/cart"
    .delete(requiresAuthentication, async (req, res) => {
        const currUser = req.user

        const user = await User.findOne({_id: req.params.user_id})
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

            // Remove the product from the user's cart
            let found = false
            for (let i = 0; i < user.cart.length && !found; i++) {
                if (user.cart[i].product_id.toString() == req.params.product_id) {
                    user.cart.splice(i, 1)
                    found = true
                }
            }

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