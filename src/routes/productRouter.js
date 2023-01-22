const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const { validationResult, checkSchema } = require("express-validator")
const productSchema = require('../validation/productSchema')
const http = require('../utils/http')

const multer = require('multer')
const inMemoryStorage = multer.memoryStorage()
const uploadStrategy = multer({ storage: inMemoryStorage }).single('image')

const fileStorageService = require('../services/FileStorageService')

const {requiresAuthentication, requiresAdmin} = require('../middleware/auth')

// Handle requests to "/products"
router.route('/')
    // Return a list of products on a GET request to "/products"
    .get(async (req, res) => {
        limit = req.query.limit ? Math.min(req.query.limit, 500) : 100
        skip = req.query.skip ? req.query.skip : 0

        try {
            products = await Product.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean()

            for (let i = 0; i < products.length; i++) {
                products[i].image_url = fileStorageService.getImageURL(products[i].image_name)
            }

            res.json(products)
        } catch (err) {
            res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })

    // Create a new product on a POST request to "/products"
    .post(uploadStrategy, [requiresAuthentication, requiresAdmin, checkSchema(productSchema)], async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(http.statusBadRequest).json({ errors: errors.array() })
        }

        try {
            const product = new Product({
                name: req.body.name,
                description: req.body.description,
                price: req.body.price,
                stock: req.body.stock
            })

            if (req.file) {
                product.image_name = await fileStorageService.uploadImage(req.file)
            }

            const savedProduct = await product.save() 
            savedProduct.set('image_url', fileStorageService.getImageURL(savedProduct.image_name), { strict: false })
            res.status(http.statusCreated).json(savedProduct)
        } catch (err) {
            res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })

// Handle requests to a "/products/:id" where id is the id of the product
router.route('/:id')
    // Return a product on a GET request
    .get(async (req, res) => {
        try {
            const product = await Product.findOne({ _id: req.params.id }).lean()
            if (!product) {
                return res.status(http.statusNotFound).json({
                    errors: [{ msg: "Product not found" }]
                })
            }
            product.image_url = fileStorageService.getImageURL(product.image_name)
            return res.json(product)
        } catch (err) {
            return res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })

    // Replace an existing product with an updated product on a PUT request
    .put(uploadStrategy, [requiresAuthentication, requiresAdmin, checkSchema(productSchema)], async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(http.statusBadRequest).json({ errors: errors.array() })
        }

        try {
            let product = await Product.findOne({ _id: req.params.id })
            if (!product) {
                return res.status(http.statusNotFound).json({
                    errors: [{ msg: "Product not found" }]
                })
            }

            const updatedProduct = {
                name: req.body.name,
                description: req.body.description,
                price: req.body.price,
                stock: req.body.stock,
                image_name: product.image_name
            }

            if (req.file) {
                // delete old image if it is not the default image
                if (product.image_name !== "default.png") {
                    await fileStorageService.deleteImage(product.image_name)
                }

                // upload new image
                updatedProduct.image_name = await fileStorageService.uploadImage(req.file)
            }

            await Product.updateOne({ _id: product.id }, {
                $set: updatedProduct
            })

            updatedProduct.image_url = fileStorageService.getImageURL(updatedProduct.image_name)

            return res.status(http.statusOK).json(updatedProduct)
        } catch (err) {
            res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })

    // Delete a product on a DELETE request
    .delete([requiresAuthentication, requiresAdmin], async (req, res) => {
        try {
            const product = await Product.findOne({ _id: req.params.id })
            if (!product) {
                return res.status(http.statusNotFound).json({
                    errors: [{ msg: "Product not found" }]
                })
            }

            // delete image if it is not the default image
            if (product.image_name !== "default.png") {
                await fileStorageService.deleteImage(product.image_name)
            }

            await Product.deleteOne({ _id: product._id })

            return res.json({
                msg: "Product successfully deleted!",
                errors: []
            })
        } catch (err) {
            return res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })

module.exports = router