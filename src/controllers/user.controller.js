const User = require("../models/user.model");
const Tweet = require("../models/tweet.model");
const Notification = require("../models/notification.model");
const { getIoInstance } = require("../socketHandler");

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
const followUser = async (req, res, next) => {
    try {
        const { username } = req.params;
        const currentUser = req.user; // Authenticated user
        const userToFollow = await User.findOne({ username }); // Fetch full user to get ID

        if (!userToFollow) {
            const err = new Error("User to follow not found");
            err.statusCode = 404;
            throw err;
        }

        const userIdToFollow = userToFollow._id;

        if (userIdToFollow.toString() === currentUser._id.toString()) {
            const err = new Error("You cannot follow yourself");
            err.statusCode = 400;
            throw err;
        }

        if (currentUser.following.includes(userIdToFollow)) {
            const err = new Error("You are already following this user");
            err.statusCode = 400;
            throw err;
        }

        // Update both users simultaneously
        await Promise.all([
            User.findByIdAndUpdate(currentUser._id, {
                $addToSet: { following: userIdToFollow },
                $inc: { followingCount: 1 }, // Increment following count
            }),
            User.findByIdAndUpdate(userIdToFollow, {
                $addToSet: { followers: currentUser._id },
                $inc: { followerCount: 1 }, // Increment follower count
            }),
        ]);

        // --- Create Notification ---
        try {
            const notification = new Notification({
                recipient: userIdToFollow,
                sender: currentUser._id,
                type: "follow",
            });
            await notification.save();

            // Populate sender for the socket event
            const populatedNotification = await Notification.findById(
                notification._id
            )
                .populate("sender", "username name avatar")
                .lean();

            // Emit event to the user being followed
            const io = getIoInstance();
            io.to(userIdToFollow.toString()).emit(
                "notification:new",
                populatedNotification
            );
            console.log(
                `Socket event notification:new emitted to room ${userIdToFollow.toString()} for follow`
            );
        } catch (notificationError) {
            console.error(
                "Error creating/emitting follow notification:",
                notificationError
            );
            // Don't fail the main request if notification fails
        }
        // --------------------------

        // --- Emit Socket.IO Event for UI update ---
        try {
            const io = getIoInstance();
            const emitterUserId = currentUser._id.toString();
            const targetUserId = userIdToFollow.toString();

            // Emit to the user who performed the action
            io.to(emitterUserId).emit("user:follow", {
                followedUserId: targetUserId,
                followerUserId: emitterUserId,
            });
            console.log(
                `Socket event user:follow emitted to room ${emitterUserId} for target ${targetUserId}`
            );

            // Optional: Emit to the user who was followed (for notifications etc.)
            // io.to(targetUserId).emit("user:followed_by", {
            //     followerUserId: emitterUserId,
            // });
            // console.log(`Socket event user:followed_by emitted to room ${targetUserId} from ${emitterUserId}`);
        } catch (socketError) {
            // Log socket error but don't fail the HTTP request
            console.error(
                "Socket.IO emission error in followUser:",
                socketError
            );
        }
        // ---------------------------

        res.status(200).json({
            status: "success",
            message: `You are now following ${username}`,
        });
    } catch (error) {
        // Pass error to the central error handler
        next(error);
    }
};

/**
 * Unfollow a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const unfollowUser = async (req, res, next) => {
    try {
        const { username } = req.params;
        const currentUser = req.user;
        // Fetch the user to unfollow and select necessary fields
        const targetUser = await User.findOne({ username }).select(
            "_id username name avatar"
        );

        if (!targetUser) {
            const err = new Error("User to unfollow not found");
            err.statusCode = 404;
            throw err;
        }

        if (!currentUser.following.includes(targetUser._id)) {
            const err = new Error("You are not following this user");
            err.statusCode = 400;
            throw err;
        }

        // Update both users simultaneously
        await Promise.all([
            User.findByIdAndUpdate(currentUser._id, {
                $pull: { following: targetUser._id },
            }),
            User.findByIdAndUpdate(targetUser._id, {
                $pull: { followers: currentUser._id },
            }),
        ]);

        // --- Emit Socket.IO Event ---
        try {
            const io = getIoInstance();
            const emitterUserId = currentUser._id.toString();
            const targetUserId = targetUser._id.toString();

            // Emit to the user who performed the action
            // Include the unfollowed user's data
            io.to(emitterUserId).emit("user:unfollow", {
                unfollowedUserId: targetUserId,
                unfollowerUserId: emitterUserId,
                unfollowedUserData: {
                    // Add user data
                    _id: targetUser._id,
                    username: targetUser.username,
                    name: targetUser.name,
                    avatar: targetUser.avatar,
                },
            });
            console.log(
                `Socket event user:unfollow emitted to room ${emitterUserId} for target ${targetUserId} with data`
            );
        } catch (socketError) {
            console.error(
                "Socket.IO emission error in unfollowUser:",
                socketError
            );
        }
        // ---------------------------

        res.status(200).json({
            status: "success",
            message: `You unfollowed ${username}`,
        });
    } catch (error) {
        next(error);
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

/**
 * Get user suggestions for mentions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserSuggestions = async (req, res, next) => {
    try {
        const query = req.query.q || "";
        const currentUserId = req.user._id; // Ensure user doesn't get suggested to themself

        // Basic validation: require at least 1 character for suggestions
        if (query.length < 1) {
            return res
                .status(200)
                .json({ status: "success", data: { suggestions: [] } });
        }

        // Escape regex characters in the query to prevent injection
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        const regex = new RegExp("^" + escapedQuery, "i"); // Case-insensitive starts-with

        const suggestions = await User.find({
            _id: { $ne: currentUserId }, // Exclude the current user
            $or: [{ username: regex }, { name: regex }],
        })
            .select("_id username name avatar") // Select only necessary fields
            .limit(5); // Limit the number of suggestions

        res.status(200).json({
            status: "success",
            data: {
                suggestions: suggestions,
            },
        });
    } catch (error) {
        // Pass error to the central error handler
        next(error);
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
    getUserSuggestions,
};
