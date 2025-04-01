const { validationResult } = require("express-validator");

/**
 * Middleware to handle validation errors from express-validator
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error("Validation failed");
        error.statusCode = 422; // Unprocessable Entity
        // Format errors for clearer client feedback
        error.data = errors.array().map((err) => ({
            field: err.path,
            message: err.msg,
        }));
        return next(error); // Pass to central error handler
    }
    next();
};

module.exports = { handleValidationErrors };
