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
            res.status(http.StatusInternalServerError).json("Error: Unexpected error encountered")
        }
    })
    .post(checkSchema(productSchema), async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(http.StatusBadRequest).json({ errors: errors.array() })
        }

        const token = req.header('Authorization')
        if (!token) {
            return res.status(http.StatusUnauthorized).json("Error: Unauthenticated")
        }

        let u = undefined
        try {
            u = jwt.verify(token, process.env.SECRET_TOKEN)
        } catch (err) {
            return res.status(http.StatusUnauthorized).json("Error: Invalid Authentication Token")
        }

        const user = await User.findOne({_id: u._id})
        if (!user) {
            return res.status(http.StatusBadRequest).json("Error: Authenticated User not found")
        }

        try {
            const product = new Product({
                name: req.body.name,
                description: req.body.description,
                price: req.body.price,
                seller: user._id
            })

            const savedProduct = await product.save()
            res.status(http.StatusCreated).json(savedProduct)
        } catch(err) {
            res.status(http.StatusInternalServerError).json("Error: Unexpected error encountered")
        }
    })

router.route('/:id')
    .get(async (req, res) => {
        try {
            const product = await Product.findOne({ _id: req.params.id })
            if (!product) {
                return res.status(http.StatusNotFound).json("Error: Product not found")
            }
            return res.json(product)
        } catch(err) {
            return res.status(http.StatusInternalServerError).json("Error: Unexpected error encountered")
        }
    })
    .put(checkSchema(productSchema), async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(http.StatusBadRequest).json({ errors: errors.array() })
        }

        const token = req.header('Authorization')
        if (!token) {
            return res.status(http.StatusUnauthorized).json('Error: Unauthenticated')
        }

        let u = undefined
        try {
            u = jwt.verify(token, process.env.SECRET_TOKEN)
        } catch(err) {
            return res.status(http.StatusUnauthorized).json("Error: Invalid Authentication Token")
        }

        try {
            let product = await Product.findOne({ _id: req.params.id })
            if (!product) {
                return res.status(http.StatusNotFound).json("Product not found")
            }

            if (product.seller != u._id) {
                return res.status(http.StatusForbidden).json("User is unauthorized to update this product")
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

            return res.status(http.StatusCreated).json(updatedProduct)
        } catch(err) {
            res.status(http.StatusInternalServerError).json("Error: Unexpected error encountered")
        }
    })
    .delete(async (req, res) => {
        const token = req.header('Authorization')
        if (!token) {
            return res.status(http.StatusUnauthorized).json("Error: Unauthenticated")
        }

        let u = undefined
        try {
            u = jwt.verify(token, process.env.SECRET_TOKEN)
        } catch(err) {
            return res.status(http.StatusUnauthorized).json("Error: Invalid User Authentication Token")
        }

        try {
            const product = await Product.findOne({ _id: req.params.id })
            if (!product) {
                return res.status(http.StatusNotFound).json("Product not found")
            }
            if (product.seller != u._id) {
                return res.status(http.StatusForbidden).json("Error: User is unauthorized to delete this product")
            }

            await Product.deleteOne({_id: product._id})

            return res.json("Success")
        } catch(err) {
            return res.status(http.StatusInternalServerError).json("Error: Unexpected error encountered")
        }
    })

module.exports = router