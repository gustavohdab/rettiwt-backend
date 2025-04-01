const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/upload.controller");
const upload = require("../middleware/upload.middleware");
const { protect } = require("../middleware/auth.middleware");

/**
 * @route POST /api/upload/tweet
 * @desc Upload media for a tweet
 * @access Private
 */
router.post(
    "/tweet",
    protect,
    upload.tweetMedia,
    uploadController.uploadTweetMedia
);

/**
 * @route POST /api/upload/avatar
 * @desc Upload user avatar
 * @access Private
 */
router.post("/avatar", protect, upload.avatar, uploadController.uploadAvatar);

/**
 * @route POST /api/upload/header
 * @desc Upload user profile header
 * @access Private
 */
router.post("/header", protect, upload.header, uploadController.uploadHeader);

module.exports = router;
