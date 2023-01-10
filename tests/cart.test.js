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

    const product3 = new Product({
        name: "product3 cart",
        description: "cart test product3",
        price: 24.99,
        stock: 99
    })
    await product3.save()

    products.push(product)
    products.push(product2)
    products.push(product3)
    
    const hp = await bcrypt.hash("user-cart", 10)
    
    const user = new User({
        email: "user@cart.test",
        username: "UserCart",
        password: hp,
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

describe("GET /cart/:user_id", () => {
    test("should get products stored in the user's cart", async () => {
        const u = await request(app).post("/login").send({
            email: "user@cart.test",
            password: "user-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user@cart.test" })

        const res = await request(app).get(`/cart/${user._id}`).set("Authorization", u.headers["authorization"])
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveLength(2)
    })

    // authorized user should see other user's cart
    test("authorized user should see other user's cart", async () => {
        const u = await request(app).post("/login").send({
            email: "admin@cart.test",
            password: "admin-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user@cart.test" })

        const res = await request(app).get(`/cart/${user._id}`).set("Authorization", u.headers["authorization"])
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveLength(2)
    })

    test("unauthenticated user should fail to see a cart", async () => {
        const user = await User.findOne({ email: "user@cart.test" })
        const res = await request(app).get(`/cart/${user._id}`)
        expect(res.statusCode).toBe(http.statusUnauthorized)
        expect(res.body).toHaveProperty("errors")
    })

    // unauthorized user should not see other user's cart
    test("unauthorized user should not see other user's cart", async () => {
        const u = await request(app).post("/login").send({
            email: "user2@cart.test",
            password: "user2-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user@cart.test" })
        const res = await request(app).get(`/cart/${user._id}`).set("Authorization", u.headers["authorization"])
        expect(res.statusCode).toBe(http.statusForbidden)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to get cart of non-existent user", async () => {
        const u = await request(app).post("/login").send({
            email: "admin@cart.test",
            password: "admin-cart"
        })

        const res = await request(app).get(`/cart/${mongoose.Types.ObjectId()}`).set("Authorization", u.headers["authorization"])
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body).toHaveProperty("errors")
    })
})

describe("POST /cart/:user_id", () => {
    test("should successfully save a product in the cart", async () => {
        const u = await request(app).post("/login").send({
            email: "user2@cart.test",
            password: "user2-cart",
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user2@cart.test" })

        const res = await request(app).post(`/cart/${user._id}`).set("Authorization", u.headers["authorization"]).send({
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
        const u = await request(app).post("/login").send({
            email: "admin@cart.test",
            password: "admin-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user2@cart.test" })
        const res = await request(app).post(`/cart/${user._id}`).set("Authorization", u.headers["authorization"]).send({
            product_id: products[1]._id,
            quantity: 1
        })
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveProperty("msg")

        const updatedUser = await User.findOne({ email: "user2@cart.test" })
        expect(updatedUser.cart).toHaveLength(2)
    })

    test("should fail to save a non-existing product to the cart", async () => {
        const u = await request(app).post("/login").send({
            email: "user2@cart.test",
            password: "user2-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user2@cart.test" })

        const res = await request(app).post(`/cart/${user._id}`).set("Authorization", u.headers["authorization"]).send({
            product_id: "5f8b9b9b9b9b9b9b9b9b9b9b",
            quantity: 1
        })
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body).toHaveProperty("errors")

        const updatedUser = await User.findOne({ email: "user2@cart.test" })
        expect(updatedUser.cart).toHaveLength(2)
    })

    test("should fail to add a product with quantity of 0 to the cart", async () => {
        const u = await request(app).post("/login").send({
            email: "user2@cart.test",
            password: "user2-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user2@cart.test" })
        const res = await request(app).post(`/cart/${user._id}`).set("Authorization", u.headers["authorization"]).send({
            product_id: products[2]._id,
            quantity: 0
        })
        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to add a product with quantity more than the product's stock", async() => {
        const u = await request(app).post("/login").send({
            email: "user2@cart.test",
            password: "user2-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user2@cart.test" })
        const res = await request(app).post(`/cart/${user._id}`).set("Authorization", u.headers["authorization"]).send({
            product_id: products[2]._id,
            quantity: products[0].stock + 1
        })
        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to add same product to the cart twice", async () => {
        const u = await request(app).post("/login").send({
            email: "user2@cart.test",
            password: "user2-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user2@cart.test" })
        const res = await request(app).post(`/cart/${user._id}`).set("Authorization", u.headers["authorization"]).send({
            product_id: products[0]._id,
            quantity: 1
        })
        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to save a product to non-existent user's cart", async () => {
        const u = await request(app).post("/login").send({
            email: "admin@cart.test",
            password: "admin-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const res = await request(app).post(`/cart/${mongoose.Types.ObjectId()}`).set("Authorization", u.headers["authorization"]).send({
            product_id: products[2]._id,
            quantity: 1
        })
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body).toHaveProperty("errors")
    })
})

describe("PUT /cart/:user_id/:product_id", () => {
    test("should successfully update a product with id in the cart", async () => {
        const u = await request(app).post("/login").send({
            email: "user@cart.test",
            password: "user-cart",
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user@cart.test" })
        const res = await request(app).put(`/cart/${user._id}/${products[0]._id}`).set("Authorization", u.headers["authorization"]).send({
            quantity: 2
        })
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveProperty("msg")

        const updatedUser = await User.findOne({ email: "user@cart.test" })
        expect(updatedUser.cart[0].quantity).toBe(2)
    })

    test("should fail to update a product with id in the cart with quantity of 0", async () => {
        const u = await request(app).post("/login").send({
            email: "user@cart.test",
            password: "user-cart",
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user@cart.test" })
        const res = await request(app).put(`/cart/${user._id}/${products[0]._id}`).set("Authorization", u.headers["authorization"]).send({
            quantity: 0
        })
        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body).toHaveProperty("errors")

        const updatedUser = await User.findOne({ email: "user@cart.test" })
        expect(updatedUser.cart[0].quantity).toBe(2)
    })

    test("should fail to update a product with id in the cart with quantity more than the product's stock", async () => {
        const u = await request(app).post("/login").send({
            email: "user2@cart.test",
            password: "user2-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user2@cart.test" })
        const res = await request(app).put(`/cart/${user._id}/${products[0]._id}`).set("Authorization", u.headers["authorization"]).send({
            quantity: products[0].stock + 1
        })
        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to update a non-existing product in the cart", async () => {
        const u = await request(app).post("/login").send({
            email: "user@cart.test",
            password: "user-cart",
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user@cart.test" })
        const res = await request(app).put(`/cart/${user._id}/${mongoose.Types.ObjectId()}`).set("Authorization", u.headers["authorization"]).send({
            quantity: 1
        })
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body).toHaveProperty("errors")
    })
})

describe("DELETE /cart/:user_id/:product_id", () => {
    test("should successfully remove a product with id from the cart", async () => {
        const u = await request(app).post("/login").send({
            email: "user@cart.test",
            password: "user-cart",
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user@cart.test" })

        const res = await request(app).delete(`/cart/${user._id}/${products[0]._id}`).set("Authorization", u.headers["authorization"])
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveProperty("msg")

        const updatedUser = await User.findOne({ email: "user@cart.test" })
        expect(updatedUser.cart).toHaveLength(1)
        expect(updatedUser.cart[0].product_id).toEqual(products[1]._id)
    })

    test("moderator should successfully remove product from another user's cart", async () => {
        const u = await request(app).post("/login").send({
            email: "admin@cart.test",
            password: "admin-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user@cart.test" })

        const res = await request(app).delete(`/cart/${user._id}/${products[1]._id}`).set("Authorization", u.headers["authorization"])
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toHaveProperty("msg")

        const updatedUser = await User.findOne({ email: "user@cart.test" })
        expect(updatedUser.cart).toHaveLength(0)
    })
    
    test("unauthorized user should fail to remove any products", async () => {
        const u = await request(app).post("/login").send({
            email: "user2@cart.test",
            password: "user2-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user@cart.test" })

        const res = await request(app).delete(`/cart/${user._id}/${products[1]._id}`).set("Authorization", u.headers["authorization"])
        expect(res.statusCode).toBe(http.statusForbidden)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to remove a product that is not in the cart", async () => {
        const u = await request(app).post("/login").send({
            email: "user@cart.test",
            password: "user-cart",
        })
        expect(u.statusCode).toBe(http.statusOK)

        const user = await User.findOne({ email: "user@cart.test" })

        const res = await request(app).delete(`/cart/${user._id}/${products[0]._id}`).set("Authorization", u.headers["authorization"])
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body).toHaveProperty("errors")
    })

    test("should fail to remove a product from non-existent user's cart", async () => {
        const u = await request(app).post("/login").send({
            email: "admin@cart.test",
            password: "admin-cart"
        })
        expect(u.statusCode).toBe(http.statusOK)

        const res = await request(app).delete(`/cart/${mongoose.Types.ObjectId()}/${products[1]._id}`).set("Authorization", u.headers["authorization"])
        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.body).toHaveProperty("errors")
    })
})
