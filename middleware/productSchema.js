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
    }
}

module.exports = productSchema