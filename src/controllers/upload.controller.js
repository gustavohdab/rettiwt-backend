const User = require("../models/user.model");
const fs = require("fs");
const path = require("path");

/**
 * Process tweet media uploads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const uploadTweetMedia = async (req, res) => {
    try {
        // Get uploaded files
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "No files uploaded",
            });
        }

        // Prepare file info for response
        const media = files.map((file) => ({
            type: file.mimetype.startsWith("image/") ? "image" : "video",
            url: `/uploads/tweets/${file.filename}`,
            altText: "",
        }));

        res.status(200).json({
            status: "success",
            data: {
                media,
            },
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Process avatar upload
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                status: "error",
                message: "No file uploaded",
            });
        }

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;

        // Update user's avatar in database
        await User.findByIdAndUpdate(req.user._id, { avatar: avatarUrl });

        res.status(200).json({
            status: "success",
            data: {
                avatar: avatarUrl,
            },
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Process header upload
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const uploadHeader = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                status: "error",
                message: "No file uploaded",
            });
        }

        const headerUrl = `/uploads/headers/${req.file.filename}`;

        // Update user's header image in database
        await User.findByIdAndUpdate(req.user._id, { headerImage: headerUrl });

        res.status(200).json({
            status: "success",
            data: {
                headerImage: headerUrl,
            },
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

module.exports = {
    uploadTweetMedia,
    uploadAvatar,
    uploadHeader,
};
