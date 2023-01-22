
/**
 * httpResponses holds commonly used HTTP response codes
 * @description HTTP response codes
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status}
 */
const httpResponses = {
    /**
     * 200 - OK
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/200}
     */
    statusOK: 200,

    /**
     * 201 - Created
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/201}
     */
    statusCreated: 201,

    /**
     * 400 - Bad Request
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400}
     */
    statusBadRequest: 400,

    /**
     * 401 - Unauthorized
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401}
     */
    statusUnauthorized: 401,

    /**
     * 403 - Forbidden
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403}
     */
    statusForbidden: 403,

    /**
     * 404 - Not Found
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404}
     */ 
    statusNotFound: 404,

    /**
     * 500 - Internal Server Error
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500}
     */ 
    statusInternalServerError: 500,

    /**
     * 501 - Not Implemented
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/501}
     */ 
    statusNotImplemented: 501
}
module.exports = httpResponses