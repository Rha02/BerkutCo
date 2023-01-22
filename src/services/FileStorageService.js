const { BlockBlobClient } = require('@azure/storage-blob')
const crypto = require('crypto')

/**
 * createImageName() creates a UUID name for an image to be stored in the file storage
 * @param {String} image_name 
 * @returns new image name
 * 
 * @example
 * const image_name = createImageName(req.file.originalname)
 */
const createImageName = (image_name) => {
    const extension = image_name.split('.').pop()
    return crypto.randomUUID() + '.' + extension
}

module.exports = {
    /**
     * uploadImage() takes an image file, creates a unique name for it and uploads it to the file storage
     * @param {Express.Multer.File} imageFile 
     * @returns Promise that resolves to the name of the image
     * 
     * @example
     * const image_name = await FileStorageService.uploadImage(req.file)
     * const image_url = FileStorageService.getImageURL(image_name)
     * const product = new Product({
     *    name: req.body.name,
     *    description: req.body.description,
     *    price: req.body.price,
     *    stock: req.body.stock,
     *    image_name: image_name
     * })
     * await product.save()
     * product.image_url = image_url
     * res.status(httpResponses.statusCreated).json({ message: 'Product created', product: product })
     * 
     * @see {@link https://www.npmjs.com/package/@azure/storage-blob}
     */
    uploadImage: async (imageFile) => {
        const image_name = createImageName(imageFile.originalname)
        const blobClient = new BlockBlobClient(
            process.env.AZURE_STORAGE_CONNECTION_STRING,
            "images",
            image_name
        )
        await blobClient.uploadData(imageFile.buffer)
        await blobClient.setHTTPHeaders({ blobContentType: `${imageFile.mimetype}` })
        return image_name
    },

    /**
     * getImageURL() takes a name of the image and returns a complete URL to that image
     * @param {String} image_name 
     * @returns image url
     * 
     * @example
     * const image_url = FileStorageService.getImageURL(image_name)
     */
    getImageURL: (image_name) => {
        return `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/images/${image_name}`
    },

    /**
     * deleteImage() is an asynchronous operation that takes a name of the image and deletes it from the file storage if it exists
     * @param {String} image_name
     * 
     * @example
     * await FileStorageService.deleteImage(product.image_name)
     */
    deleteImage: async (image_name) => {
        const blobClient = new BlockBlobClient(
            process.env.AZURE_STORAGE_CONNECTION_STRING,
            "images",
            image_name
        )
        await blobClient.deleteIfExists()
    }
}