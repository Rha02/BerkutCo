/**productSchema defines a request validation schema for creating or updating products */
const productSchema = {
    name: {
        isLength: {
            errorMessage: 'Name of the product must be at least 5 characters long',
            options: [
                { min: 5 }, { max: 200 }
            ]
        }
    },
    description: {
        isLength: {
            errorMessage: 'Product description cannot exceed 2500 characters',
            options: { max: 2500 }
        }
    },
    price: {
        isFloat: {
            errorMessage: 'Price cannot be lower than 0 or larger than 99999.99',
            options: [
                { min: 0, max: 99999.99}
            ]
        }
    },
    stock: {
        isInt: {
            errorMessage: 'Stock must be at least 1 or more',
            options: { min: 1 }
        }
    },
    image: {
        custom: {
            options: (value, { req }) => {
                if (req.file) {
                    return req.file.mimetype.startsWith('image/')
                }
                return true
            }
        }
    }
}

module.exports = productSchema