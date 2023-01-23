const app = require('./app_test')
const User = require('../src/models/user')
const Product = require('../src/models/product')
const mongoose = require('mongoose')
const request = require('supertest')
const http = require('../src/utils/http')
const bcrypt = require('bcrypt')
const cacheService = require('../src/services/CacheService')
const config = require('../config')

const products = []
const sessions = {}


beforeAll(async () => {
    await mongoose.connect(config.TEST_MONGO_URI)
        .catch(err => {
            console.error(`Error connecting to MongoDB: ${err}`)
            process.exitCode = 1
        })

    // Connect to Redis
    await cacheService.connect({
        host: config.TEST_REDIS_HOST,
        port: config.TEST_REDIS_PORT
    }).catch(err => {
        console.error(`Error connecting to Redis: ${err}`)
        process.exitCode = 1
    })

    const hashedPasswordPromises = [
        bcrypt.hash("admin-product", 10),
        bcrypt.hash("user-product", 10)
    ]
    const promises = []

    // Create dummy products
    const product = new Product({
        name: "product 1",
        description: "this is product 1",
        price: 10.49,
        stock: 10
    })
    promises.push(product.save())

    const product2 = new Product({
        name: "product 2",
        description: "this is product 2",
        price: 5.73,
        stock: 10
    })
    promises.push(product2.save())

    const product3 = new Product({
        name: "product 3",
        description: "this is product 3",
        price: 13.21,
        stock: 10
    })
    promises.push(product3.save())

    const hashedPasswords = await Promise.all(hashedPasswordPromises)
    // Create a test user
    const admin = new User({
        email: "admin@product.test",
        username: "AdminProduct",
        password: hashedPasswords[0],
        access_level: 3
    })
    promises.push(admin.save())

    // Create a second test user
    const user = new User({
        email: "user@product.test",
        username: "UserProduct",
        password: hashedPasswords[1],
    })
    promises.push(user.save())

    // Wait for all promises to resolve then push products to the products array
    while (promises.length > 0) {
        const p = await promises.pop()
        if (p instanceof Product) {
            products.push(p)
        }
    }

    // Login the test users
    promises.push(request(app).post("/login").send({ email: "admin@product.test", password: "admin-product"}))
    promises.push(request(app).post("/login").send({ email: "user@product.test", password: "user-product" }))

    // Wait for all promises to resolve then push sessions to the sessions object
    while (promises.length > 0) {
        const res = await promises.pop()
        expect(res.statusCode).toBe(http.statusOK)
        sessions[res.body["email"]] = res.headers["authorization"]
    }
})

afterAll(async () => {
    const promises = [User.deleteMany({ email: { $regex: /product.test/ } })]
    // Delete the dummy user and products
    for (let i = 0; i < products.length; i++) {
        promises.push(products[i].delete())
    }
    await Promise.all(promises) 
    await mongoose.connection.close()
    await cacheService.disconnect()
})

describe("GET /products", () => {
    test("should get products", async () => {
        const res = await request(app).get("/products").expect("Content-Type", /json/)
        expect(res.statusCode).toBe(http.statusOK)
    })
})

describe("GET /products/:id", () => {
    test("should get product", async () => {
        const product = await Product.findOne({ name: "product 1" })
        const res = await request(app).get(`/products/${product._id}`)
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body["_id"]).toBe(product._id.toString())
    })

    test("should not find product", async () => {
        productId = mongoose.Types.ObjectId();
        const res = await request(app).get(`/products/${productId}`)
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body["_id"]).toBeUndefined()
    })
})

describe("POST /products", () => {
    test("users with access level 2 or higher should create a product", async () => {
        const res = await request(app).post("/products").set({"Authorization": sessions["admin@product.test"]}).send({
            name: "product 4",
            description: "this is product 4",
            price: 20,
            stock: 10
        })
        expect(res.statusCode).toBe(http.statusCreated)
        expect(res.body["_id"]).toBeDefined()

        await Product.deleteOne({"_id": res.body["_id"]})
    })

    test("unauthenticated user should fail to create a product", async () => {
        const res = await request(app).post("/products").send({
            name: "product 4",
            description: "this is product 4",
            price: 20,
            stock: 10
        })
        expect(res.statusCode).toBe(http.statusUnauthorized)
        expect(res.body["_id"]).toBeUndefined()
    })

    test("unauthorized user should fail to create a product", async () => {
        const res = await request(app).post("/products").set({ "Authorization": sessions["user@product.test"] }).send({
            name: "product 4",
            description: "this is product 4",
            price: 20,
            stock: 10
        })
        expect(res.statusCode).toBe(http.statusForbidden)
        expect(res.body["_id"]).toBeUndefined()
    })

    test("product name should be at least 5 characters long", async () => {
        const res = await request(app).post("/products").set({ "Authorization": sessions["admin@product.test"] }).send({
            name: "123",
            description: "this is product 4",
            price: 20,
            stock: 10
        })
        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body["_id"]).toBeUndefined()
    })

    test("product price should not be negative", async () => {
        const res = await request(app).post("/products").set({ "Authorization": sessions["admin@product.test"] }).send({
            name: "product 4",
            description: "this is product 4",
            price: -1,
            stock: 10
        })
        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body["_id"]).toBeUndefined()
    })

    test("product stock should be at least 1 or more", async () => {
        const res = await request(app).post("/products").set({ "Authorization": sessions["admin@product.test"] }).send({
            name: "product 4",
            description: "this is product 4",
            price: 20,
            stock: 0
        })
        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body["_id"]).toBeUndefined()
    })
})

describe("PUT /products/:id", () => {
    test("authorized user should successfully update a product", async () => {
        const product = await Product.findOne({ name: "product 1" })
        const res = await request(app).put(`/products/${product._id}`).set({ "Authorization": sessions["admin@product.test"] }).send({
            name: "updated product 1",
            description: "updated description",
            price: 20.59,
            stock: 10
        })

        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body["name"]).toBe("updated product 1")
    })

    test("unauthorized user should fail to update a product", async () => {
        const product = await Product.findOne({ name: "product 2" })
        const res = await request(app).put(`/products/${product._id}`).set({ "Authorization": sessions["user@product.test"] }).send({
            name: "updated product 2",
            description: "updated description",
            price: 20.59,
            stock: 10
        })

        expect(res.statusCode).toBe(http.statusForbidden)
        expect(res.body["name"]).toBeUndefined()
    })

    test("product name should be at least 5 characters long", async () => {
        const product = await Product.findOne({ name: "product 2" })
        const res = await request(app).put(`/products/${product._id}`).set({ "Authorization": sessions["admin@product.test"] }).send({
            name: "123",
            description: "updated description",
            price: 20.59,
            stock: 10
        })

        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body["name"]).toBeUndefined()
    })

    test("product price should not be negative", async () => {
        const product = await Product.findOne({ name: "product 2" })
        const res = await request(app).put(`/products/${product._id}`).set({ "Authorization": sessions["admin@product.test"] }).send({
            name: "12345",
            description: "updated description",
            price: -5,
            stock: 10
        })

        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body["name"]).toBeUndefined()
    })

    test("product stock should be at least 1 or more", async () => {
        const product = await Product.findOne({ name: "product 2" })
        const res = await request(app).put(`/products/${product._id}`).set({ "Authorization": sessions["admin@product.test"] }).send({
            name: "12345",
            description: "updated description",
            price: 25,
            stock: 0
        })

        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body["name"]).toBeUndefined()
    })

    test("should not find product", async () => {
        const id = mongoose.Types.ObjectId()
        const res = await request(app).put(`/products/${id}`).set({ "Authorization": sessions["admin@product.test"] }).send({
            name: "12345",
            description: "updated description",
            price: 20.59,
            stock: 10
        })

        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body["name"]).toBeUndefined()
    })
})

describe("DELETE /products/:id", () => {
    test("authorized user should delete product", async () => {
        const product = await Product.findOne({ name: "product 3" })
        const res = await request(app).delete(`/products/${product._id}`).set({ "Authorization": sessions["admin@product.test"] })
        expect(res.statusCode).toBe(http.statusOK)
        expect(await Product.findOne({ _id: product._id })).toBeNull()
    })

    test("unauthorized user should fail to delete product", async () => {
        const product = await Product.findOne({ name: "product 2" })
        const res = await request(app).delete(`/products/${product._id}`).set({ "Authorization": sessions["user@product.test"] })
        expect(res.statusCode).toBe(http.statusForbidden)
    })

    test("should not find product to delete", async () => {
        const id = mongoose.Types.ObjectId()
        const res = await request(app).delete(`/products/${id}`).set({ "Authorization": sessions["admin@product.test"] })
        expect(res.statusCode).toBe(http.statusNotFound)
    })
})
