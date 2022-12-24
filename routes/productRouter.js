const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const User = require('../models/user')
const { validationResult, checkSchema } = require("express-validator")
const jwt = require('jsonwebtoken')
const productSchema = require('../middleware/productSchema')
const http = require('../utils/http')

router.route('/')
    .get(async (req, res) => {
        limit = req.query.limit ? Math.min(req.query.limit, 500) : 100
        skip = req.query.skip ? req.query.skip : 0

        try {
            products = await Product.find().sort({createdAt: -1}).skip(skip).limit(limit)
            res.json(products)
        } catch(err) {
            res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })
    .post(checkSchema(productSchema), async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(http.statusBadRequest).json({ errors: errors.array() })
        }

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

        const user = await User.findOne({_id: u._id})
        if (!user) {
            return res.status(http.statusBadRequest).json({
                errors: [{ msg: "Invalid authentication token" }]
            })
        }

        try {
            const product = new Product({
                name: req.body.name,
                description: req.body.description,
                price: req.body.price,
                seller: user._id
            })

            const savedProduct = await product.save()
            res.status(http.statusCreated).json(savedProduct)
        } catch(err) {
            res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })

router.route('/:id')
    .get(async (req, res) => {
        try {
            const product = await Product.findOne({ _id: req.params.id })
            if (!product) {
                return res.status(http.statusNotFound).json({
                    errors: [{ msg: "Product not found" }]
                })
            }
            return res.json(product)
        } catch(err) {
            return res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })
    .put(checkSchema(productSchema), async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(http.statusBadRequest).json({ errors: errors.array() })
        }

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
            let product = await Product.findOne({ _id: req.params.id })
            if (!product) {
                return res.status(http.statusNotFound).json({
                    errors: [{ msg: "Product not found" }]
                })
            }

            if (product.seller != u._id) {
                return res.status(http.statusForbidden).json({
                    errors: [{ msg: "User is unauthorized to access this resource" }]
                })
            }

            const updatedProduct = {
                name: req.body.name,
                description: req.body.description,
                price: req.body.price,
                seller: u._id
            }

            await Product.updateOne({_id: product.id}, {
                $set: updatedProduct
            })

            return res.status(http.statusOK).json(updatedProduct)
        } catch(err) {
            res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })
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
        } catch(err) {
            return res.status(http.statusUnauthorized).json({
                errors: [{ msg: "Invalid authentication token" }]
            })
        }

        try {
            const product = await Product.findOne({ _id: req.params.id })
            if (!product) {
                return res.status(http.statusNotFound).json({
                    errors: [{ msg: "Product not found" }]
                })
            }
            if (product.seller != u._id) {
                return res.status(http.statusForbidden).json({
                    errors: [{ msg: "User is unauthorized to access this resource" }]
                })
            }

            await Product.deleteOne({_id: product._id})
            
            return res.json({
                msg: "Product successfully deleted!",
                errors: []
            })
        } catch(err) {
            return res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })

module.exports = router