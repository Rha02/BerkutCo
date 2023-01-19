const http = require('../utils/http');

const requiresAuthentication = async (req, res, next) => {
    try {
        const token = req.header('Authorization');
        if (!token) {
            return res.status(http.statusUnauthorized).send({ errors: [{ msg: "Unauthenticated" }] });
        }

        const redisClient = req.app.get('redisClient');
        const res = await redisClient.get(token);
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