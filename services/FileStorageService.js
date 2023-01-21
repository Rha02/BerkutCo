const { BlockBlobClient } = require('@azure/storage-blob')
const crypto = require('crypto')

/**
 * createImageName() creates a UUID name for an image to be stored in the file storage
 * @param {String} image_name 
 * @returns 
 */
const createImageName = (image_name) => {
    const extension = image_name.split('.').pop()
    return crypto.randomUUID() + '.' + extension
}

module.exports = {
    /**
     * uploadImage() takes an image file, creates a unique name for it and uploads it to the file storage
     * @param {Express.Multer.File} imageFile 
     * @returns new name of uploaded image
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
     */
    getImageURL: (image_name) => {
        return `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/images/${image_name}`
    },

    /**
     * deleteImage() takes a name of the image and deletes it from the file storage if it exists
     * @param {String} image_name
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