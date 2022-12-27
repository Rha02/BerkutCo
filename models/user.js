const mongoose = require('mongoose')

/**userSchema defines a schema for the User model*/
const userSchema = mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true,
        min: [8, 'Password must be at least 8 characters long'],
        max: [100, 'Password cannot exceed 100 characters']
    },
    username: {
        type: String,
        required: true,
        min: [6, 'Username must be at least 6 characters long'],
        max: [50, 'Username cannot exceed 50 characters']
    }
})

module.exports = mongoose.model('User', userSchema)