const express = require("express");
const { body, param } = require("express-validator");
const userController = require("../controllers/user.controller");
const { protect, optionalAuth } = require("../middleware/auth.middleware");
const {
    handleValidationErrors,
} = require("../middleware/validation.middleware");

const router = express.Router();

// Validation Rules
const usernameParamValidation = [
    param("username")
        .isString()
        .trim()
        .notEmpty()
        .withMessage("Username parameter is required"),
];

const updateProfileValidation = [
    body("name")
        .optional() // Allow partial updates
        .isString()
        .trim()
        .notEmpty()
        .withMessage("Name cannot be empty")
        .isLength({ max: 50 })
        .withMessage("Name cannot exceed 50 characters")
        .escape(),
    body("bio")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 160 })
        .withMessage("Bio cannot exceed 160 characters")
        .escape(),
    body("location")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 30 })
        .withMessage("Location cannot exceed 30 characters")
        .escape(),
    body("website")
        .optional({
            checkFalsy: true, // Allow empty string '' to be considered optional
        })
        .isString()
        .trim()
        .isURL({
            protocols: ["http", "https"],
            require_protocol: true,
            require_valid_protocol: true,
        })
        .withMessage("Please provide a valid website URL (http/https)")
        .isLength({ max: 100 })
        .withMessage("Website URL cannot exceed 100 characters"),
];

/**
 * @route GET /api/users/recommendations/paginated
 * @desc Get paginated user recommendations for "Who to Follow" page
 * @access Private
 */
router.get(
    "/recommendations/paginated",
    protect, // Requires user to be logged in
    userController.getPaginatedRecommendedUsers
);

/**
 * @route GET /api/users/suggestions
 * @desc Get user suggestions for mentions based on query
 * @access Private
 */
router.get("/suggestions", protect, userController.getUserSuggestions);

/**
 * @route GET /api/users/bookmarks
 * @desc Get current user's bookmarked tweets
 * @access Private
 */
router.get("/bookmarks", protect, userController.getUserBookmarks);

/**
 * @route PATCH /api/users/profile
 * @desc Update user profile
 * @access Private
 */
router.patch(
    "/profile",
    protect,
    updateProfileValidation,
    handleValidationErrors,
    userController.updateUserProfile
);

/**
 * @route GET /api/users/:username
 * @desc Get user profile by username
 * @access Public (with optional auth for additional data)
 */
router.get(
    "/:username",
    optionalAuth,
    usernameParamValidation,
    handleValidationErrors,
    userController.getUserProfile
);

/**
 * @route POST /api/users/:username/follow
 * @desc Follow a user
 * @access Private
 */
router.post(
    "/:username/follow",
    protect,
    usernameParamValidation,
    handleValidationErrors,
    userController.followUser
);

/**
 * @route DELETE /api/users/:username/follow
 * @desc Unfollow a user
 * @access Private
 */
router.delete(
    "/:username/follow",
    protect,
    usernameParamValidation,
    handleValidationErrors,
    userController.unfollowUser
);

/**
 * @route GET /api/users/:username/followers
 * @desc Get user followers
 * @access Public
 */
router.get(
    "/:username/followers",
    optionalAuth,
    usernameParamValidation,
    handleValidationErrors,
    userController.getUserFollowers
);

/**
 * @route GET /api/users/:username/following
 * @desc Get users that a user is following
 * @access Public
 */
router.get(
    "/:username/following",
    optionalAuth,
    usernameParamValidation,
    handleValidationErrors,
    userController.getUserFollowing
);

module.exports = router;
