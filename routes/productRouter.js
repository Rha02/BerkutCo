const express = require('express')
const router = express.Router()
const Product = require('../models/product')

router.route('/')
    .get((req, res) => {
        res.json({
            message: "GET: /products"
        })
    })
    .post((req, res) => {
        res.json({
            message: "POST: /products"
        })
    })

router.route('/:id')
    .get((req, res) => {
        res.json({
            message: `GET: /products/${req.params.id}`
        })
    })
    .put((req, res) => {
        res.json({
            message: `PUT: /products/${req.params.id}`
        })
    })

module.exports = router