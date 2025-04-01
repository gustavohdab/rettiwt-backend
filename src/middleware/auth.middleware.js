const { verifyAccessToken } = require("../utils/jwt.utils");
const User = require("../models/user.model");

/**
 * Middleware to protect routes that require authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const protect = async (req, res, next) => {
    try {
        // Get token from authorization header
        let token;
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ) {
            token = req.headers.authorization.split(" ")[1];
        }

        // Check if token exists
        if (!token) {
            const error = new Error(
                "Not authenticated. Please log in to access this resource."
            );
            error.statusCode = 401;
            return next(error);
        }

        // Verify token
        const decoded = verifyAccessToken(token);
        if (!decoded) {
            const error = new Error("Token is invalid or expired.");
            error.statusCode = 401;
            return next(error);
        }

        // Check if user still exists
        const user = await User.findById(decoded.id);
        if (!user || !user.isActive) {
            const error = new Error(
                "The user belonging to this token no longer exists."
            );
            error.statusCode = 401;
            return next(error);
        }

        // Grant access to protected route
        req.user = user;
        next();
    } catch (error) {
        // Catch verification errors or other unexpected issues
        const authError = new Error(
            "Authentication failed. Please log in again."
        );
        authError.statusCode = 401;
        next(authError); // Pass error to the central handler
    }
};

/**
 * Middleware to restrict access to specific roles
 * @param {...String} roles - Allowed roles
 * @returns {Function} Middleware function
 */
const restrictTo = (...roles) => {
    return (req, res, next) => {
        // Check if user role is included in the allowed roles
        if (!roles.includes(req.user.role)) {
            const error = new Error(
                "You do not have permission to perform this action."
            );
            error.statusCode = 403;
            return next(error); // Use next(error) for consistency
        }
        next();
    };
};

/**
 * Optional authentication middleware - authenticate if token exists,
 * but continue even if no token is provided
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
    try {
        let token;
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return next(); // Continue without authentication
        }

        const decoded = verifyAccessToken(token);
        if (decoded) {
            const user = await User.findById(decoded.id);
            if (user && user.isActive) {
                req.user = user;
            }
        }

        next();
    } catch (error) {
        // If token verification fails in optional auth, just proceed without user
        // Do not pass the error, as it's not critical for optional routes
        next();
    }
};

module.exports = {
    protect,
    restrictTo,
    optionalAuth,
};
