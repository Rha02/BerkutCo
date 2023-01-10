
const cartSchema = {
    product_id: {
        isString: true
    },
    quantity: {
        isInt: {
            errorMessage: 'Quantity must be an integer',
            options: { min: 1 }
        }
    }
}

module.exports = cartSchema