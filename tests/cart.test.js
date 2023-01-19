const app = require('../app_test')
const User = require('../models/user')
const Product = require('../models/product')
const mongoose = require('mongoose')
const request = require('supertest')
const http = require('../utils/http')
const bcrypt = require('bcrypt')
const redis = require('redis')

const products = []
const sessions = {}

beforeAll(async () => {
    await mongoose.connect("mongodb://localhost:27017")
        .catch(err => {
            console.error(`Error connecting to MongoDB: ${err}`)
            process.exitCode = 1
        })
    
    const redisClient = redis.createClient()
    await redisClient.connect()
    app.set("redisClient", redisClient)
    
    const hashedPasswordPromises = [
        bcrypt.hash("user-cart", 10),
        bcrypt.hash("user2-cart", 10),
        bcrypt.hash("admin-cart", 10)
    ]
    const promises = []

    const product = new Product({
        name: "product cart",
        description: "cart test product",
        price: 24.99,
        stock: 99
    })
    promises.push(product.save())

    const product2 = new Product({
        name: "product2 cart",
        description: "cart test product2",
        price: 24.99,
        stock: 99
    })
    promises.push(product2.save())

    const product3 = new Product({
        name: "product3 cart",
        description: "cart test product3",
        price: 24.99,
        stock: 99
    })
    promises.push(product3.save())

    const hashedPasswords = await Promise.all(hashedPasswordPromises)
    
    while (promises.length > 0) {
        const p = await promises.shift()
        products.push(p)
    }

    const user = new User({
        email: "user@cart.test",
        username: "UserCart",
        password: hashedPasswords[0],
        cart: [
            {
                product_id: product._id,
                quantity: 2
            },
            {
                product_id: product2._id,
                quantity: 2
            }
        ]
    })
    promises.push(user.save())

    const user2 = new User({
        email: "user2@cart.test",
        username: "User2Cart",
        password: hashedPasswords[1],
    })
    promises.push(user2.save())

    const admin = new User({
        email: "admin@cart.test",
        username: "AdminCart",
        password: hashedPasswords[2],
        access_level: 3
    })
    promises.push(admin.save())

    // Wait for all promises to resolve
    while (promises.length > 0) {
        await promises.pop()
    }

    // Login the test users
    promises.push(request(app).post("/login").send({ email: "admin@cart.test", password: "admin-cart" }))
    promises.push(request(app).post("/login").send({ email: "user@cart.test", password: "user-cart" }))
    promises.push(request(app).post("/login").send({ email: "user2@cart.test", password: "user2-cart" }))

    // Wait for all promises to resolve then push sessions to the sessions object
    while (promises.length > 0) {
        const res = await promises.pop()
        expect(res.statusCode).toBe(http.statusOK)
        sessions[res.body["email"]] = {
            token: res.headers["authorization"],
            user: res.body
        }
    }
})

afterAll(async () => {
    const promises = []
    promises.push(User.deleteMany({ email: { $regex: /@cart.test$/ } }))
    promises.push(Product.deleteMany({ name: { $in: products.map(p => p.name) } }))

    await Promise.all(promises)

    await mongoose.connection.close()
    await app.get("redisClient").quit()
})

describe("GET /cart/:user_id", () => {
    test("should get products stored in the user's cart", async () => {
        const userID = sessions["user@cart.test"].user._id
        const authToken = sessions["user@cart.test"].token

        const res = await request(app).get(`/cart/${userID}`).set("Authorization", authToken)
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveLength(2)
    })

    // authorized user should see other user's cart
    test("authorized user should see other user's cart", async () => {
        const userID = sessions["user@cart.test"].user._id
        const authToken = sessions["admin@cart.test"].token

        const res = await request(app).get(`/cart/${userID}`).set("Authorization", authToken)
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveLength(2)
    })

    test("unauthenticated user should fail to see a cart", async () => {
        const userID = sessions["user@cart.test"].user._id
        const res = await request(app).get(`/cart/${userID}`)
        expect(res.statusCode).toBe(http.statusUnauthorized)
        expect(res.body).toHaveProperty("errors")
    })

    // unauthorized user should not see other user's cart
    test("unauthorized user should not see other user's cart", async () => {
        const userID = sessions["user@cart.test"].user._id
        const authToken = sessions["user2@cart.test"].token

        const res = await request(app).get(`/cart/${userID}`).set("Authorization", authToken)
        expect(res.statusCode).toBe(http.statusForbidden)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to get cart of non-existent user", async () => {
        const authToken = sessions["admin@cart.test"].token

        const res = await request(app).get(`/cart/${mongoose.Types.ObjectId()}`).set("Authorization", authToken)
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body).toHaveProperty("errors")
    })
})

describe("POST /cart/:user_id", () => {
    test("should successfully save a product in the cart", async () => {
        const userID = sessions["user2@cart.test"].user._id
        const authToken = sessions["user2@cart.test"].token

        const res = await request(app).post(`/cart/${userID}`).set("Authorization", authToken).send({
            product_id: products[0]._id,
            quantity: 1
        })
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveProperty("msg")

        const updatedUser = await User.findOne({ email: "user2@cart.test" })
        expect(updatedUser.cart).toHaveLength(1)
        expect(updatedUser.cart[0].product_id).toEqual(products[0]._id)
    })

    test("unauthenticated user should fail to save a product in the cart", async () => {
        const id = "5f8b9b9b9b9b9b9b9b9b9b9b"
        const res = await request(app).post(`/cart/${id}`).send({
            product_id: products[2]._id,
            quantity: 1
        })

        expect(res.statusCode).toBe(http.statusUnauthorized)
        expect(res.body).toHaveProperty("errors")
    })

    // authorized user should save a product to other user's cart
    test("authorized user should save a product to other user's cart", async () => {
        const userID = sessions["user2@cart.test"].user._id
        const authToken = sessions["admin@cart.test"].token

        const res = await request(app).post(`/cart/${userID}`).set("Authorization", authToken).send({
            product_id: products[1]._id,
            quantity: 1
        })
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveProperty("msg")

        const updatedUser = await User.findOne({ email: "user2@cart.test" })
        expect(updatedUser.cart).toHaveLength(2)
    })

    test("should fail to save a non-existing product to the cart", async () => {
        const userID = sessions["user2@cart.test"].user._id
        const authToken = sessions["user2@cart.test"].token

        const res = await request(app).post(`/cart/${userID}`).set("Authorization", authToken).send({
            product_id: "5f8b9b9b9b9b9b9b9b9b9b9b",
            quantity: 1
        })
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body).toHaveProperty("errors")

        const updatedUser = await User.findOne({ email: "user2@cart.test" })
        expect(updatedUser.cart).toHaveLength(2)
    })

    test("should fail to add a product with quantity of 0 to the cart", async () => {
        const userID = sessions["user2@cart.test"].user._id
        const authToken = sessions["user2@cart.test"].token

        const res = await request(app).post(`/cart/${userID}`).set("Authorization", authToken).send({
            product_id: products[2]._id,
            quantity: 0
        })
        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to add a product with quantity more than the product's stock", async () => {
        const userID = sessions["user2@cart.test"].user._id
        const authToken = sessions["user2@cart.test"].token

        const res = await request(app).post(`/cart/${userID}`).set("Authorization", authToken).send({
            product_id: products[2]._id,
            quantity: products[0].stock + 1
        })
        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to add same product to the cart twice", async () => {
        const userID = sessions["user2@cart.test"].user._id
        const authToken = sessions["user2@cart.test"].token

        const res = await request(app).post(`/cart/${userID}`).set("Authorization", authToken).send({
            product_id: products[0]._id,
            quantity: 1
        })
        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to save a product to non-existent user's cart", async () => {
        const authToken = sessions["admin@cart.test"].token

        const res = await request(app).post(`/cart/${mongoose.Types.ObjectId()}`).set("Authorization", authToken).send({
            product_id: products[2]._id,
            quantity: 1
        })
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body).toHaveProperty("errors")
    })
})

describe("PUT /cart/:user_id/:product_id", () => {
    test("should successfully update a product with id in the cart", async () => {
        const userID = sessions["user@cart.test"].user._id
        const authToken = sessions["user@cart.test"].token

        const res = await request(app).put(`/cart/${userID}/${products[0]._id}`).set("Authorization", authToken).send({
            quantity: 2
        })
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveProperty("msg")

        const updatedUser = await User.findOne({ email: "user@cart.test" })
        expect(updatedUser.cart[0].quantity).toBe(2)
    })

    test("authorized user should successfully update another user's cart", async () => {
        const userID = sessions["user@cart.test"].user._id
        const authToken = sessions["admin@cart.test"].token

        const res = await request(app).put(`/cart/${userID}/${products[1]._id}`).set("Authorization", authToken).send({
            quantity: 2
        })
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveProperty("msg")

        const updatedUser = await User.findOne({ email: "user@cart.test" })
        expect(updatedUser.cart[1].quantity).toBe(2)
    })

    test("unauthorized user should fail to update another user's cart", async () => {
        const userID = sessions["user@cart.test"].user._id
        const authToken = sessions["user2@cart.test"].token

        const res = await request(app).put(`/cart/${userID}/${products[0]._id}`).set("Authorization", authToken).send({
            quantity: 3
        })

        expect(res.statusCode).toBe(http.statusForbidden)
        expect(res.body).toHaveProperty("errors")

        const updatedUser = await User.findOne({ email: "user@cart.test" })
        expect(updatedUser.cart[0].quantity).toBe(2)
    })

    test("should fail to update a product with id in the cart with quantity of 0", async () => {
        const userID = sessions["user@cart.test"].user._id
        const authToken = sessions["admin@cart.test"].token

        const res = await request(app).put(`/cart/${userID}/${products[0]._id}`).set("Authorization", authToken).send({
            quantity: 0
        })
        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body).toHaveProperty("errors")

        const updatedUser = await User.findOne({ email: "user@cart.test" })
        expect(updatedUser.cart[0].quantity).toBe(2)
    })

    test("should fail to update a product with id in the cart with quantity more than the product's stock", async () => {
        const userID = sessions["user2@cart.test"].user._id
        const authToken = sessions["user2@cart.test"].token

        const res = await request(app).put(`/cart/${userID}/${products[0]._id}`).set("Authorization", authToken).send({
            quantity: products[0].stock + 1
        })
        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to update a non-existing product in the cart", async () => {
        const userID = sessions["user@cart.test"].user._id
        const authToken = sessions["user@cart.test"].token

        const res = await request(app).put(`/cart/${userID}/${mongoose.Types.ObjectId()}`).set("Authorization", authToken).send({
            quantity: 1
        })
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body).toHaveProperty("errors")
    })
})

describe("DELETE /cart/:user_id/:product_id", () => {
    test("should successfully remove a product with id from the cart", async () => {
        const userID = sessions["user@cart.test"].user._id
        const authToken = sessions["user@cart.test"].token

        const res = await request(app).delete(`/cart/${userID}/${products[0]._id}`).set("Authorization", authToken)
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveProperty("msg")

        const updatedUser = await User.findOne({ email: "user@cart.test" })
        expect(updatedUser.cart).toHaveLength(1)
        expect(updatedUser.cart[0].product_id).toEqual(products[1]._id)
    })

    test("moderator should successfully remove product from another user's cart", async () => {
        const userID = sessions["user@cart.test"].user._id
        const authToken = sessions["admin@cart.test"].token

        const res = await request(app).delete(`/cart/${userID}/${products[1]._id}`).set("Authorization", authToken)
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveProperty("msg")

        const updatedUser = await User.findOne({ email: "user@cart.test" })
        expect(updatedUser.cart).toHaveLength(0)
    })

    test("unauthorized user should fail to remove any products", async () => {
        const userID = sessions["user@cart.test"].user._id
        const authToken = sessions["user2@cart.test"].token

        const res = await request(app).delete(`/cart/${userID}/${products[1]._id}`).set("Authorization", authToken)
        expect(res.statusCode).toBe(http.statusForbidden)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to remove a product that is not in the cart", async () => {
        const userID = sessions["user@cart.test"].user._id
        const authToken = sessions["user@cart.test"].token

        const res = await request(app).delete(`/cart/${userID}/${products[0]._id}`).set("Authorization", authToken)
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to remove a product from non-existent user's cart", async () => {
        const authToken = sessions["admin@cart.test"].token

        const res = await request(app).delete(`/cart/${mongoose.Types.ObjectId()}/${products[1]._id}`).set("Authorization", authToken)
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body).toHaveProperty("errors")
    })
})
