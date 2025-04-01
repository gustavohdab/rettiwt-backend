const express = require("express");
const { body } = require("express-validator"); // Import only body now
const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const {
    handleValidationErrors,
} = require("../middleware/validation.middleware"); // Import shared handler

const router = express.Router();

// Middleware to handle validation results (Removed from here)
// const handleValidationErrors = (req, res, next) => { ... };

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post(
    "/register",
    [
        body("name", "Name is required").not().isEmpty().trim().escape(),
        body("username", "Username is required")
            .not()
            .isEmpty()
            .trim()
            .escape(),
        body("email", "Please include a valid email")
            .isEmail()
            .normalizeEmail(),
        body(
            "password",
            "Password must be at least 6 characters long"
        ).isLength({ min: 6 }),
    ],
    handleValidationErrors, // Apply validation check middleware
    authController.register
);

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post(
    "/login",
    [
        body("usernameOrEmail", "Username or Email is required")
            .not()
            .isEmpty()
            .trim(),
        body("password", "Password is required").not().isEmpty(),
    ],
    handleValidationErrors, // Apply validation check middleware
    authController.login
);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post(
    "/refresh",
    [body("refreshToken", "Refresh token is required").not().isEmpty()],
    handleValidationErrors,
    authController.refreshToken
);

/**
 * @route GET /api/auth/me
 * @desc Get current user
 * @access Private
 */
router.get("/me", protect, authController.getCurrentUser);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post("/logout", protect, authController.logout);

module.exports = router;
