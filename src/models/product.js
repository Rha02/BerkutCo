const mongoose = require("mongoose")

/**productSchema defines a schema for the Product model */
const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        minLength: [5, 'Name of the product must be at least 5 characters long'],
        maxLength: [200, 'Name of the product cannot exceed 200 characters']
    },
    description: {
        type: String,
        required: true,
        maxLength: [2500, 'Product description cannot exceed 2500 characters']
    },
    price: {
        type: Number,
        required: true,
        min: [0, 'Minimum price of an item is zero'],
        max: [99999.99, 'Products higher than the price of $99999.99 are not supported']
    },
    stock: {
        type: Number,
        required: true,
        validate: { validator: Number.isInteger }
    },
    image_name: {
        type: String,
        default: "default.png"
    }
}, {timestamps: true})

module.exports = mongoose.model('Product', productSchema)