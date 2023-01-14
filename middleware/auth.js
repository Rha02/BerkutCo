const jwt = require('jsonwebtoken');
const User = require('../models/user');
const http = require('../utils/http');

const requiresAuthentication = async (req, res, next) => {
    try {
        const token = req.header('Authorization');
        if (!token) {
            return res.status(http.statusUnauthorized).send({ errors: [{ msg: "Unauthenticated" }] });
        }
        const decoded = jwt.verify(token, process.env.SECRET_TOKEN);
        const user = await User.findOne({ _id: decoded._id });

        if (!user) {
            return res.status(http.statusUnauthorized).send({ errors: [{ msg: "Invalid authentication token" }] });
        }

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