const app = require('../app')
const User = require('../models/user')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const request = require('supertest')
const http = require('../utils/http')

beforeAll(async () => {
    await mongoose.connect(process.env.TEST_DATABASE_URL)
        .catch(err => {
            console.error(`Error connecting to MongoDB: ${err}`)
            process.exitCode = 1
        })
    // Create a test user
    const hashedPassword = await bcrypt.hash("fake-password", 10)
    const user = new User({
        email: "fake@email.test",
        username: "testuser",
        password: hashedPassword
    })
    await user.save()
})

afterAll(async () => {
    // Delete the test user
    await User.deleteOne({ email: "fake@email.test" })
    await mongoose.connection.close()
})

describe("POST /login", () => {
    test("should successfuly login", async () => {
        const res = await request(app).post("/login").expect("Content-Type", /json/).send({
            email: "fake@email.test",
            password: "fake-password"
        })
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.headers["authorization"]).toBeDefined()
        expect(res.body).toMatchObject({
            _id: expect.any(String),
            username: "testuser",
            email: "fake@email.test",
            access_level: 1,
            cart: expect.any(Array),
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
        })
        expect(res.body).not.toHaveProperty("password")
    })

    test("user email should not be found", async () => {
        const res = await request(app).post("/login").expect("Content-Type", /json/).send({
            email: "doesnotexit@email.test",
            password: "fake-password"
        })

        expect(res.statusCode).toBe(http.statusNotFound)
        expect(res.headers["authorization"]).toBeUndefined()
        expect(res.body).toHaveProperty("errors")
    })

    test("password should be incorrect", async () => {
        const res = await request(app).post("/login").expect("Content-Type", /json/).send({
            email: "fake@email.test",
            password: "wrong-password"
        })

        expect(res.statusCode).toBe(http.statusUnauthorized)
        expect(res.headers["authorization"]).toBeUndefined()
        expect(res.body).toHaveProperty("errors")
    })
})

describe("POST /register", () => {
    test("should successfully register", async () => {
        const res = await request(app).post("/register").expect("Content-Type", /json/).send({
            email: "john@email.loc",
            username: "JohnDoe",
            password: "TheJohnDoe"
        })

        expect(res.statusCode).toBe(http.statusCreated)
        expect(res.body).toMatchObject({
            _id: expect.any(String),
            msg: "User created successfully",
        })

        await User.deleteOne({_id: res.body._id})
    })

    test("email in wrong email format", async () => {
        const res = await request(app).post("/register").expect("Content-Type", /json/).send({
            email: "not an email",
            username: "JohnDoe",
            password: "TheJohnDoe"
        })

        expect(res.statusCode).toBe(http.statusBadRequest)
    })

    test("email already be in use", async () => {
        const res = await request(app).post("/register").expect("Content-Type", /json/).send({
            email: "fake@email.test",
            username: "JohnDoe",
            password: "TheJohnDoe"
        })

        expect(res.statusCode).toBe(http.statusBadRequest)
        expect(res.body).toHaveProperty("errors")
    })

    test("username already be in use", async () => {
        const res = await request(app).post("/register").expect("Content-Type", /json/).send({
            email: "john@email.loc",
            username: "testuser",
            password: "TheJohnDoe"
        })

        expect(res.statusCode).toBe(http.statusBadRequest)
    })

    test("password less than 8 characters", async () => {
        const res = await request(app).post("/register").expect("Content-Type", /json/).send({
            email: "john@email.loc",
            username: "JohnDoe",
            password: "12345"
        })

        expect(res.statusCode).toBe(http.statusBadRequest)
    })

    test("username less than 6 characters", async () => {
        const res = await request(app).post("/register").expect("Content-Type", /json/).send({
            email: "john@email.loc",
            username: "12345",
            password: "TheJohnDoe"
        })

        expect(res.statusCode).toBe(http.statusBadRequest)
    })
})

describe("GET /checkauth", () => {
    test("should successfully get current user", async () => {
        const res1 = await request(app).post("/login").send({
            email: "fake@email.test",
            password: "fake-password"
        })
        expect(res1.statusCode).toBe(http.statusOK)

        const res2 = await request(app).get("/checkauth").set({"Authorization": res1.headers["authorization"]})
        expect(res2.statusCode).toBe(http.statusOK)
        expect(res2.body).toMatchObject({
            _id: expect.any(String),
            email: "fake@email.test",
            username: "testuser",
            access_level: 1,
            cart: expect.any(Array),
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
        })
        expect(res2.body).not.toHaveProperty("password")
    })

    test("missing authorization token", async () => {
        const res = await request(app).get("/checkauth")
        expect(http.statusBadRequest)
        expect(res.body).toHaveProperty("errors")
    })

    test("invalid authorization token", async () => {
        const res = await request(app).get("/checkauth").set({"Authorization": "invalid token here"})
        expect(http.statusBadRequest)
        expect(res.body).toHaveProperty("errors")
    })
})