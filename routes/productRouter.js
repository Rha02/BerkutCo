const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const User = require('../models/user')
const { validationResult, checkSchema } = require("express-validator")
const jwt = require('jsonwebtoken')
const productSchema = require('../middleware/productSchema')
const http = require('../utils/http')

const multer = require('multer')
const inMemoryStorage = multer.memoryStorage()
const uploadStrategy = multer({ storage: inMemoryStorage }).single('image')
const { BlockBlobClient } = require('@azure/storage-blob')

const crypto = require('crypto')

// createImageName() creates a unique name for the image file
const createImageName = (image_name) => {
    const extension = image_name.split('.').pop()
    return crypto.randomUUID() + '.' + extension
}

// Handle requests to "/products"
router.route('/')
    // Return a list of products on a GET request to "/products"
    .get(async (req, res) => {
        limit = req.query.limit ? Math.min(req.query.limit, 500) : 100
        skip = req.query.skip ? req.query.skip : 0

        try {
            products = await Product.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean()

            for (let i = 0; i < products.length; i++) {
                products[i].image_url = `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/images/${products[i].image_name}`
            }

            res.json(products)
        } catch (err) {
            res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })

    // Create a new product on a POST request to "/products"
    .post(uploadStrategy, checkSchema(productSchema), async (req, res) => {
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

        const user = await User.findOne({ _id: u._id })
        if (!user) {
            return res.status(http.statusBadRequest).json({
                errors: [{ msg: "Invalid authentication token" }]
            })
        }

        if (user.access_level < 2) {
            return res.status(http.statusForbidden).json({
                errors: [{ msg: "User is unauthorized to access this resource" }]
            })
        }

        try {
            const product = new Product({
                name: req.body.name,
                description: req.body.description,
                price: req.body.price,
                stock: req.body.stock
            })

            const image_name = req.file ? createImageName(req.file.originalname) : null
            
            if (req.file) {
                const blobClient = new BlockBlobClient(
                    process.env.AZURE_STORAGE_CONNECTION_STRING, 
                    "images", 
                    image_name)
                await blobClient.uploadData(req.file.buffer)
                await blobClient.setHTTPHeaders({ blobContentType: `${req.file.mimetype}` })
                product.image_name = image_name
            }

            const savedProduct = await product.save() 
            savedProduct.set('image_url', `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/images/${savedProduct.image_name}`, { strict: false })
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
            product.image_url = `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/images/${product.image_name}`
            return res.json(product)
        } catch (err) {
            return res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })

    // Replace an existing product with an updated product on a PUT request
    .put(uploadStrategy, checkSchema(productSchema), async (req, res) => {
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

        const user = await User.findOne({ _id: u._id })
        if (!user) {
            return res.status(http.statusBadRequest).json({
                errors: [{ msg: "Invalid authentication token" }]
            })
        }

        if (user.access_level < 2) {
            return res.status(http.statusForbidden).json({
                errors: [{ msg: "User is unauthorized to access this resource" }]
            })
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
                const image_name = createImageName(req.file.originalname)
                const blobClient = new BlockBlobClient(process.env.AZURE_STORAGE_CONNECTION_STRING, "images", image_name)
                await blobClient.uploadData(req.file.buffer)
                await blobClient.setHTTPHeaders({ blobContentType: `${req.file.mimetype}` })
                updatedProduct.image_name = image_name
                
                // delete old image if it is not the default image
                if (product.image_name !== "default.png") {
                    const oldBlobClient = new BlockBlobClient(process.env.AZURE_STORAGE_CONNECTION_STRING, "images", product.image_name)
                    await oldBlobClient.deleteIfExists()
                }
            }

            await Product.updateOne({ _id: product.id }, {
                $set: updatedProduct
            })

            updatedProduct.image_url = `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/images/${updatedProduct.image_name}`

            return res.status(http.statusOK).json(updatedProduct)
        } catch (err) {
            res.status(http.statusInternalServerError).json({
                errors: [{ msg: "Unexpected error encountered" }]
            })
        }
    })

    // Delete a product on a DELETE request
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

        const user = await User.findOne({ _id: u._id })
        if (!user) {
            return res.status(http.statusBadRequest).json({
                errors: [{ msg: "Invalid authentication token" }]
            })
        }
        
        if (user.access_level < 2) {
            return res.status(http.statusForbidden).json({
                errors: [{ msg: "User is unauthorized to access this resource" }]
            })
        }

        try {
            const product = await Product.findOne({ _id: req.params.id })
            if (!product) {
                return res.status(http.statusNotFound).json({
                    errors: [{ msg: "Product not found" }]
                })
            }

            // delete image if it is not the default image
            if (product.image_name !== "default.png") {
                const blobClient = new BlockBlobClient(process.env.AZURE_STORAGE_CONNECTION_STRING, "images", product.image_name)
                await blobClient.deleteIfExists()
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