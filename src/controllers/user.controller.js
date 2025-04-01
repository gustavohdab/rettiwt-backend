const User = require("../models/user.model");
const Tweet = require("../models/tweet.model");

/**
 * Get user profile by username
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserProfile = async (req, res) => {
    try {
        const { username } = req.params;

        const user = await User.findOne({ username })
            .populate("following", "username name avatar")
            .populate("followers", "username name avatar");

        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        // Get tweet count
        const tweetCount = await Tweet.countDocuments({
            author: user._id,
            isDeleted: false,
        });

        res.status(200).json({
            status: "success",
            data: {
                user,
                tweetCount,
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
 * Update user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateUserProfile = async (req, res) => {
    try {
        const allowedFields = [
            "name",
            "bio",
            "location",
            "website",
            "birthdate",
        ];

        // Filter out non-allowed fields
        const filteredBody = {};
        Object.keys(req.body).forEach((key) => {
            if (allowedFields.includes(key)) {
                filteredBody[key] = req.body[key];
            }
        });

        // Update user
        const user = await User.findByIdAndUpdate(req.user._id, filteredBody, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({
            status: "success",
            data: {
                user,
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
 * Follow another user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const followUser = async (req, res) => {
    try {
        const { username } = req.params;

        // Find target user
        const targetUser = await User.findOne({ username });
        if (!targetUser) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        // Check if user is trying to follow themselves
        if (targetUser._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                status: "error",
                message: "You cannot follow yourself",
            });
        }

        // Check if already following
        if (req.user.following.includes(targetUser._id)) {
            return res.status(400).json({
                status: "error",
                message: "You are already following this user",
            });
        }

        // Update current user's following
        await User.findByIdAndUpdate(req.user._id, {
            $push: { following: targetUser._id },
        });

        // Update target user's followers
        await User.findByIdAndUpdate(targetUser._id, {
            $push: { followers: req.user._id },
        });

        res.status(200).json({
            status: "success",
            message: `You are now following ${targetUser.username}`,
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Unfollow a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const unfollowUser = async (req, res) => {
    try {
        const { username } = req.params;

        // Find target user
        const targetUser = await User.findOne({ username });
        if (!targetUser) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        // Check if not following
        if (!req.user.following.includes(targetUser._id)) {
            return res.status(400).json({
                status: "error",
                message: "You are not following this user",
            });
        }

        // Update current user's following
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { following: targetUser._id },
        });

        // Update target user's followers
        await User.findByIdAndUpdate(targetUser._id, {
            $pull: { followers: req.user._id },
        });

        res.status(200).json({
            status: "success",
            message: `You unfollowed ${targetUser.username}`,
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Get user followers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserFollowers = async (req, res) => {
    try {
        const { username } = req.params;

        const user = await User.findOne({ username }).populate(
            "followers",
            "username name avatar bio"
        );

        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        res.status(200).json({
            status: "success",
            data: {
                followers: user.followers,
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
 * Get users that a user is following
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserFollowing = async (req, res) => {
    try {
        const { username } = req.params;

        const user = await User.findOne({ username }).populate(
            "following",
            "username name avatar bio"
        );

        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        res.status(200).json({
            status: "success",
            data: {
                following: user.following,
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
 * Get current user's bookmarked tweets
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserBookmarks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Find the user with their bookmarks
        const user = await User.findById(req.user._id).populate({
            path: "bookmarks",
            match: { isDeleted: false },
            options: {
                sort: { createdAt: -1 },
                skip: skip,
                limit: limit,
            },
            populate: [
                {
                    path: "author",
                    select: "username name avatar",
                },
                {
                    path: "quotedTweet",
                    populate: {
                        path: "author",
                        select: "username name avatar",
                    },
                },
            ],
        });

        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        // Get total bookmarks count for pagination
        const totalBookmarks = await User.aggregate([
            { $match: { _id: user._id } },
            { $project: { bookmarkCount: { $size: "$bookmarks" } } },
        ]);

        const total =
            totalBookmarks.length > 0 ? totalBookmarks[0].bookmarkCount : 0;

        res.status(200).json({
            status: "success",
            data: {
                bookmarks: user.bookmarks,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
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
    getUserProfile,
    updateUserProfile,
    followUser,
    unfollowUser,
    getUserFollowers,
    getUserFollowing,
    getUserBookmarks,
};
