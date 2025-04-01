const express = require("express");
const { query } = require("express-validator");
const searchController = require("../controllers/search.controller");
const { optionalAuth } = require("../middleware/auth.middleware");
const {
    handleValidationErrors,
} = require("../middleware/validation.middleware");

const router = express.Router();

// Validation Rules
const searchQueryValidation = [
    query("q")
        .trim()
        .notEmpty()
        .withMessage("Search query parameter 'q' is required")
        .isLength({ min: 1, max: 100 })
        .withMessage("Search query must be between 1 and 100 characters")
        .escape(),
    query("type") // Optional filter (e.g., users, tweets)
        .optional()
        .isIn(["users", "tweets", "hashtags", "all"])
        .withMessage(
            "Invalid search type. Must be 'users', 'tweets', 'hashtags', or 'all'."
        ),
    // Add validation for pagination parameters if used (e.g., page, limit)
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),
    query("limit")
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage("Limit must be between 1 and 50"),
];

/**
 * @route GET /api/search
 * @desc Search for users, tweets, or hashtags
 * @access Public (with optional auth)
 */
router.get(
    "/",
    optionalAuth,
    searchQueryValidation,
    handleValidationErrors,
    searchController.search
);

module.exports = router;
