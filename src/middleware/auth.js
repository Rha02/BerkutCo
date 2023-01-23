const http = require('../utils/http');
const cacheService = require('../services/CacheService');

/**
 * requiresAuthentication is a middleware function that checks if the request has a valid authentication token
 * then uses it to fetch user data from Redis and attach it to the request object
 */
const requiresAuthentication = async (req, res, next) => {
    try {
        const token = req.header('Authorization');
        if (!token) {
            return res.status(http.statusUnauthorized).send({ errors: [{ msg: "Unauthenticated" }] });
        }

        const res = await cacheService.getAuthUser(token);
        if (!res) {
            return res.status(http.statusUnauthorized).send({ errors: [{ msg: "Invalid authentication token" }] });
        }
        const user = JSON.parse(res);

        req.user = user;
        next();
    } catch (e) {
        res.status(http.statusUnauthorized).send({ errors: [{ msg: "Invalid authentication token" }] });
    }
}

/**
 * requiresAdmin is a middleware function that checks if the user has admin access.
 * Admin access is defined as `access_level` >= 2
 */
const requiresAdmin = async (req, res, next) => {
    if (req.user.access_level < 2) {
        return res.status(http.statusForbidden).json({
            errors: [{ msg: "User is unauthorized to access this resource" }]
        })
    }
    next();
}

module.exports = {
    requiresAuthentication,
    requiresAdmin
}