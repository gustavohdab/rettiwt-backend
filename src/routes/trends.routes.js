const express = require("express");
const trendsController = require("../controllers/trends.controller");
const { optionalAuth } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * @route GET /api/trends/hashtags
 * @desc Get trending hashtags
 * @access Public (with optional auth)
 */
router.get("/hashtags", optionalAuth, trendsController.getTrendingHashtags);

/**
 * @route GET /api/trends/popular
 * @desc Get popular tweets
 * @access Public (with optional auth)
 */
router.get("/popular", optionalAuth, trendsController.getPopularTweets);

/**
 * @route GET /api/trends/hashtag/:hashtag
 * @desc Get tweets for a specific hashtag
 * @access Public (with optional auth)
 */
router.get(
    "/hashtag/:hashtag",
    optionalAuth,
    trendsController.getTweetsByHashtag
);

/**
 * @route GET /api/trends/who-to-follow
 * @desc Get recommended users to follow
 * @access Public (with optional auth)
 */
router.get(
    "/who-to-follow",
    optionalAuth,
    trendsController.getRecommendedUsers
);

module.exports = router;
