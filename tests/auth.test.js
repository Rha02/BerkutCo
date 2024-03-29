const app = require('./app_test')
const User = require('../src/models/user')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const request = require('supertest')
const http = require('../src/utils/http')
const cacheService = require('../src/services/CacheService')
const config = require('../config')
const jwt = require('jsonwebtoken')

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
    // sleep for 1 second
    await new Promise(resolve => setTimeout(resolve, 1000))
    // Delete the test user
    await User.deleteOne({ email: "fake@email.test" })

    await mongoose.connection.close()
    await cacheService.disconnect()
})

describe("POST /login", () => {
    test("should successfuly login", () => {
        return request(app).post("/login").expect("Content-Type", /json/).send({
            email: "fake@email.test",
            password: "fake-password"
        }).then(res => {
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
    })

    test("user email should not be found", () => {
        return request(app).post("/login").expect("Content-Type", /json/).send({
            email: "doesnotexit@email.test",
            password: "fake-password"
        }).then(res => {
            expect(res.statusCode).toBe(http.statusNotFound)
            expect(res.headers["authorization"]).toBeUndefined()
            expect(res.body).toHaveProperty("errors")
        })
    })

    test("password should be incorrect", () => {
        return request(app).post("/login").expect("Content-Type", /json/).send({
            email: "fake@email.test",
            password: "wrong-password"
        }).then(res => {
            expect(res.statusCode).toBe(http.statusUnauthorized)
            expect(res.headers["authorization"]).toBeUndefined()
            expect(res.body).toHaveProperty("errors")
        })
    })
})

describe("POST /register", () => {
    test("should successfully register", () => {
        return request(app).post("/register").expect("Content-Type", /json/).send({
            email: "john@email.loc",
            username: "JohnDoe",
            password: "TheJohnDoe"
        }).then(res => {
            expect(res.statusCode).toBe(http.statusCreated)
            expect(res.body).toMatchObject({
                _id: expect.any(String),
                msg: "User created successfully",
            })

            return User.deleteOne({ _id: res.body._id })
        })
    })

    test("email in wrong email format", () => {
        return request(app).post("/register").expect("Content-Type", /json/).send({
            email: "not an email",
            username: "JohnDoe",
            password: "TheJohnDoe"
        }).then(res => {
            expect(res.statusCode).toBe(http.statusBadRequest)
        })
    })

    test("email already be in use", () => {
        return request(app).post("/register").expect("Content-Type", /json/).send({
            email: "fake@email.test",
            username: "JohnDoe",
            password: "TheJohnDoe"
        }).then(res => {
            expect(res.statusCode).toBe(http.statusBadRequest)
            expect(res.body).toHaveProperty("errors")
        })
    })

    test("username already be in use", () => {
        return request(app).post("/register").expect("Content-Type", /json/).send({
            email: "john@email.loc",
            username: "testuser",
            password: "TheJohnDoe"
        }).then(res => {
            expect(res.statusCode).toBe(http.statusBadRequest)
            expect(res.body).toHaveProperty("errors")
        })
    })

    test("password less than 8 characters", () => {
        return request(app).post("/register").expect("Content-Type", /json/).send({
            email: "john@email.loc",
            username: "JohnDoe",
            password: "12345"
        }).then(res => {
            expect(res.statusCode).toBe(http.statusBadRequest)
        })
    })

    test("username less than 6 characters", () => {
        return request(app).post("/register").expect("Content-Type", /json/).send({
            email: "john@email.loc",
            username: "12345",
            password: "TheJohnDoe"
        }).then(res => {
            expect(res.statusCode).toBe(http.statusBadRequest)
        })
    })
})

describe("GET /checkauth", () => {
    test("should successfully get current user", () => {
        return request(app).post("/login").send({
            email: "fake@email.test",
            password: "fake-password"
        }).then(res => {
            expect(res.statusCode).toBe(http.statusOK)
            expect(res.headers["authorization"]).toBeDefined()

            return request(app).get("/checkauth").set({ "Authorization": res.headers["authorization"] }).then(res => {
                expect(res.statusCode).toBe(http.statusOK)
                expect(res.body).toMatchObject({
                    _id: expect.any(String),
                    email: "fake@email.test",
                    username: "testuser",
                    access_level: 1,
                    cart: expect.any(Array),
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String)
                })
                expect(res.body).not.toHaveProperty("password")
            })
        })
    })

    test("missing authorization token", () => {
        return request(app).get("/checkauth").then(res => {
            expect(res.statusCode).toBe(http.statusUnauthorized)
            expect(res.body).toHaveProperty("errors")
        })
    })

    test("invalid authorization token", () => {
        return request(app).get("/checkauth").set({"Authorization": "invalid token here"}).then(res => {
            expect(res.statusCode).toBe(http.statusUnauthorized)
            expect(res.body).toHaveProperty("errors")
        })
    })
})

describe("POST /logout", () => {
    test("should successfully logout", async () => {
        const u = await request(app).post("/login").send({
            email: "fake@email.test",
            password: "fake-password"
        })
        expect(u.statusCode).toBe(http.statusOK)
        expect(u.headers["authorization"]).toBeDefined()

        const res = await request(app).post("/logout").set({ "Authorization": u.headers["authorization"] })
        expect(res.statusCode).toBe(http.statusOK)
        expect(res.body).toMatchObject({
            msg: "User logged out successfully"
        })

        const authSessionExists = await cacheService.checkIfAuthUserExists(u.headers["authorization"], u.body._id)
        expect(authSessionExists).toBe(false)
    })

    test("missing authorization token", () => {
        return request(app).post("/logout").then(res => {
            expect(res.statusCode).toBe(http.statusUnauthorized)
            expect(res.body).toHaveProperty("errors")
        })
    })

    test("invalid authorization token", async () => {
        const res = await request(app).post("/logout").set({ "Authorization": "invalid token here" })
        expect(res.statusCode).toBe(http.statusUnauthorized)
        expect(res.body).toHaveProperty("errors")
    })
})