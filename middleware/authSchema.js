/**loginSchema defines a request validation schema for logging in a user */
const loginSchema = {
    email: {
        isEmail: true,
        errorMessage: 'Invalid email'
    },
    password: {
        isLength: {
            errorMessage: 'Password must be at least 8 characters long',
            options: { min: 8 }
        }
    }
}

/**registerSchema defines a request validation schema for registering a user */
const registerSchema = {
    email: {
        isEmail: true,
        errorMessage: 'Invalid email'
    },
    username: {
        isLength: {
            errorMessage: 'Username must be at least 6 characters long',
            options: { min: 6 }
        }
    },
    password: {
        isLength: {
            errorMessage: 'Password must be at least 8 characters long',
            options: { min: 8 }
        }
    }
}

module.exports.loginSchema = loginSchema
module.exports.registerSchema = registerSchema