const app = require('../app')
const User = require('../models/user')
const Product = require('../models/product')
const mongoose = require('mongoose')
const request = require('supertest')
const http = require('../utils/http')
const bcrypt = require('bcrypt')

let products = []

beforeAll(async () => {
    await mongoose.connect(process.env.TEST_DATABASE_URL)
        .catch(err => {
            console.error(`Error connecting to MongoDB: ${err}`)
            process.exitCode = 1
        })
    
    const product = new Product({
        name: "product cart",
        description: "cart test product",
        price: 24.99,
        stock: 99
    })
    await product.save()

    const product2 = new Product({
        name: "product2 cart",
        description: "cart test product2",
        price: 24.99,
        stock: 99
    })
    await product2.save()

    products.push(product)
    products.push(product2)
    
    const hp = await bcrypt.hash("user-cart", 10)
    const user = new User({
        email: "user@cart.test",
        username: "UserCart",
        password: hp,
        cart: [product._id, product2._id]
    })
    await user.save()

    const hp2 = await bcrypt.hash("user2-cart", 10)
    const user2 = new User({
        email: "user2@cart.test",
        username: "User2Cart",
        password: hp2
    })
    await user2.save()

    const hp3 = await bcrypt.hash("admin-cart", 10)
    const admin = new User({
        email: "admin@cart.test",
        username: "AdminCart",
        password: hp3,
        access_level: 3
    })
    await admin.save()
})

afterAll(async () => {
    await User.deleteOne({ email: "user@cart.test" })
    await User.deleteOne({ email: "user2@cart.test" })
    await User.deleteOne({ email: "admin@cart.test" })

    for (let i = 0; i < products.length; i++) {
        await products[i].delete()
    }

    await mongoose.connection.close()
})

describe("GET /cart", () => {
    test("should get products stored in the user's cart", async () => {
        const u = await request(app).post("/login").send({
            email: "user@cart.test",
            password: "user-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const res = await request(app).get("/cart").set("Authorization", u.headers["authorization"])
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveLength(2)
    })

    test("unauthorized user should fail to see a cart", async () => {
        const user = await User.findOne({ email: "user@cart.test" })
        const res = await request(app).get(`/cart/${user._id}`)
        expect(res.statusCode).toBe(http.statusUnauthorized)
        expect(res.body).toHaveProperty("errors")
    })
})

describe("POST /cart", () => {
    test("should successfully save a product in the cart", async () => {
        const u = await request(app).post("/login").send({
            email: "user2@cart.test",
            password: "user2-cart",
        })

        const res = await request(app).post(`/cart/${u.body._id}`).set("Authorization", u.headers["authorization"]).send({
            product_id: products[0]._id
        })
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveProperty("message")
    })

    test("unauthenticated user should fail to save a product in the cart", async () => {
        const id = "5f8b9b9b9b9b9b9b9b9b9b9b"
        const res = await request(app).post(`/cart/${id}`).send({
            product_id: products[0]._id
        })

        expect(res.statusCode).toBe(http.statusUnauthorized)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to save a non-existing product to the cart", async () => {
        const u = await request(app).post("/login").send({
            email: "user2@cart.test",
            password: "user2-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const res = await request(app).post(`/cart/${u._id}`).set("Authorization", u.headers["authorization"]).send({
            product_id: "5f8b9b9b9b9b9b9b9b9b9b9b"
        })
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body).toHaveProperty("errors")
    })
})

describe("DELETE /cart/:product_id", () => {
    test("should successfully remove a product with id from the cart", async () => {
        const u = await request(app).post("/login").send({
            email: "user@cart.test",
            password: "user-cart",
        })

        const res = await request(app).delete(`/cart/${u._id}/products/${products[0]._id}`).set("Authorization", u.headers["authorization"])
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveProperty("message")
    })

    test("moderator should successfully remove another person's cart", async () => {
        const u = await request(app).post("/login").send({
            email: "admin@cart.test",
            password: "admin-cart"
        })

        const user = await User.findOne({ email: "user@cart.test" })

        const res = await request(app).delete(`/cart/${user._id}/products/${products[0]._id}`).set("Authorization", u.headers["authorization"])
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveProperty("message")
    })
    
    test("unauthorized user should fail to remove any products", async () => {
        const u = await request(app).post("/login").send({
            email: "user2@cart.test",
            password: "user2-cart"
        })

        const user = await User.findOne({ email: "user@cart.test" })

        const res = await request(app).delete(`/cart/${u._id}/products/${products[0]._id}`).set("Authorization", u.headers["authorization"])
        expect(res.statusCode).toBe(http.statusUnauthorized)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to remove a product that is not in the cart", async () => {
        const u = await request(app).post("/login").send({
            email: "user@cart.test",
            password: "user-cart",
        })

        const res = await request(app).delete(`/cart/${u._id}/products/${products[0]._id}`).set("Authorization", u.headers["authorization"])
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body).toHaveProperty("errors")
    })
})
