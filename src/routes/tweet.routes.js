const express = require("express");
const { body, param } = require("express-validator");
const tweetController = require("../controllers/tweet.controller");
const { protect, optionalAuth } = require("../middleware/auth.middleware");
const {
    handleValidationErrors,
} = require("../middleware/validation.middleware");

const router = express.Router();

// Validation Rules
const createTweetValidation = [
    body("content")
        .isString()
        .withMessage("Content must be a string")
        .trim()
        .isLength({ min: 1, max: 280 })
        .withMessage("Content must be between 1 and 280 characters"),
    // Optional: Validate media array if present
    body("media").optional().isArray().withMessage("Media must be an array"),
    body("media.*.type")
        .optional()
        .isIn(["image", "video", "gif"])
        .withMessage("Invalid media type"),
    body("media.*.url").optional().isURL().withMessage("Invalid media URL"),
    // Optional: Validate IDs if present
    body("inReplyTo")
        .optional()
        .isMongoId()
        .withMessage("Invalid tweet ID for reply"),
    body("quotedTweet")
        .optional()
        .isMongoId()
        .withMessage("Invalid tweet ID for quote"),
];

const tweetIdParamValidation = [
    param("id").isMongoId().withMessage("Invalid Tweet ID format"),
];

const usernameParamValidation = [
    param("username")
        .isString()
        .trim()
        .notEmpty()
        .withMessage("Username parameter is required"),
];

/**
 * @route POST /api/tweets
 * @desc Create a new tweet (or reply/quote)
 * @access Private
 */
router.post(
    "/",
    protect,
    createTweetValidation,
    handleValidationErrors,
    tweetController.createTweet
);

/**
 * @route GET /api/tweets/timeline
 * @desc Get user timeline
 * @access Private
 */
router.get("/timeline", protect, tweetController.getTimeline);

/**
 * @route GET /api/tweets/user/:username
 * @desc Get user tweets
 * @access Public (but can use optionalAuth)
 */
router.get(
    "/user/:username",
    optionalAuth, // Add optional auth to potentially enhance response
    usernameParamValidation,
    handleValidationErrors,
    tweetController.getUserTweets
);

/**
 * @route GET /api/tweets/user/:username/replies
 * @desc Get user replies
 * @access Public
 */
router.get(
    "/user/:username/replies",
    optionalAuth,
    usernameParamValidation,
    handleValidationErrors,
    tweetController.getUserReplies
);

/**
 * @route GET /api/tweets/user/:username/likes
 * @desc Get tweets a user has liked
 * @access Public
 */
router.get(
    "/user/:username/likes",
    optionalAuth,
    usernameParamValidation,
    handleValidationErrors,
    tweetController.getUserLikedTweets
);

/**
 * @route GET /api/tweets/:id
 * @desc Get a tweet by ID
 * @access Public
 */
router.get(
    "/:id",
    optionalAuth,
    tweetIdParamValidation,
    handleValidationErrors,
    tweetController.getTweet
);

/**
 * @route GET /api/tweets/:id/thread
 * @desc Get a tweet and its replies
 * @access Public
 */
router.get(
    "/:id/thread",
    optionalAuth,
    tweetIdParamValidation,
    handleValidationErrors,
    tweetController.getTweetThread
);

/**
 * @route DELETE /api/tweets/:id
 * @desc Delete a tweet
 * @access Private
 */
router.delete(
    "/:id",
    protect,
    tweetIdParamValidation,
    handleValidationErrors,
    tweetController.deleteTweet
);

/**
 * @route POST /api/tweets/:id/like
 * @desc Like a tweet
 * @access Private
 */
router.post(
    "/:id/like",
    protect,
    tweetIdParamValidation,
    handleValidationErrors,
    tweetController.likeTweet
);

/**
 * @route DELETE /api/tweets/:id/like
 * @desc Unlike a tweet
 * @access Private
 */
router.delete(
    "/:id/like",
    protect,
    tweetIdParamValidation,
    handleValidationErrors,
    tweetController.unlikeTweet
);

/**
 * @route POST /api/tweets/:id/retweet
 * @desc Retweet a tweet
 * @access Private
 */
router.post(
    "/:id/retweet",
    protect,
    tweetIdParamValidation,
    handleValidationErrors,
    tweetController.retweetTweet
);

/**
 * @route DELETE /api/tweets/:id/retweet
 * @desc Undo retweet
 * @access Private
 */
router.delete(
    "/:id/retweet",
    protect,
    tweetIdParamValidation,
    handleValidationErrors,
    tweetController.undoRetweet
);

/**
 * @route POST /api/tweets/:id/bookmark
 * @desc Bookmark a tweet
 * @access Private
 */
router.post(
    "/:id/bookmark",
    protect,
    tweetIdParamValidation,
    handleValidationErrors,
    tweetController.bookmarkTweet
);

/**
 * @route DELETE /api/tweets/:id/bookmark
 * @desc Remove bookmark from a tweet
 * @access Private
 */
router.delete(
    "/:id/bookmark",
    protect,
    tweetIdParamValidation,
    handleValidationErrors,
    tweetController.unbookmarkTweet
);

module.exports = router;
