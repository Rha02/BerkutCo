const app = require('../app')
const mongoose = require('mongoose')

beforeEach(async () => {
    await mongoose.connect(process.env.TEST_DATABASE_URL)
})

afterEach(async () => {
    await mongoose.connection.close()
})