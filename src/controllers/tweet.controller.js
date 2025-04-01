const Tweet = require("../models/tweet.model");
const User = require("../models/user.model");

/**
 * Create a new tweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createTweet = async (req, res) => {
    try {
        const { content, media = [], quotedTweetId, inReplyToId } = req.body;

        // Create the tweet
        const tweet = await Tweet.create({
            content,
            author: req.user._id,
            media,
            quotedTweet: quotedTweetId || null,
            inReplyTo: inReplyToId || null,
        });

        // Update engagement count if it's a reply or quote
        if (inReplyToId) {
            await Tweet.findByIdAndUpdate(inReplyToId, {
                $inc: { "engagementCount.replies": 1 },
            });
        }

        if (quotedTweetId) {
            await Tweet.findByIdAndUpdate(quotedTweetId, {
                $inc: { "engagementCount.quotes": 1 },
            });
        }

        // Populate author information
        await tweet.populate("author", "username name avatar");

        res.status(201).json({
            status: "success",
            data: {
                tweet,
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
 * Get a tweet by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTweet = async (req, res) => {
    try {
        const { id } = req.params;

        const tweet = await Tweet.findById(id)
            .populate("author", "username name avatar")
            .populate({
                path: "quotedTweet",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            })
            .populate({
                path: "inReplyTo",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        if (!tweet || tweet.isDeleted) {
            return res.status(404).json({
                status: "error",
                message: "Tweet not found",
            });
        }

        // Increment impressions
        await Tweet.findByIdAndUpdate(id, {
            $inc: { "analytics.impressions": 1 },
        });

        // Check if user is authenticated and has bookmarked this tweet
        let tweetResponse = tweet.toObject();
        if (req.user) {
            const user = await User.findById(req.user._id);
            tweetResponse.bookmarked = user.bookmarks.includes(tweet._id);
        }

        res.status(200).json({
            status: "success",
            data: {
                tweet: tweetResponse,
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
 * Get a tweet with its replies (thread)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTweetThread = async (req, res) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Get the main tweet
        const tweet = await Tweet.findById(id)
            .populate("author", "username name avatar")
            .populate({
                path: "quotedTweet",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            })
            .populate({
                path: "inReplyTo",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        if (!tweet || tweet.isDeleted) {
            return res.status(404).json({
                status: "error",
                message: "Tweet not found",
            });
        }

        // Get replies to this tweet
        const replies = await Tweet.find({
            inReplyTo: id,
            isDeleted: false,
        })
            .sort({ createdAt: 1 }) // Oldest first for a conversation
            .skip(skip)
            .limit(limit)
            .populate("author", "username name avatar")
            .populate({
                path: "quotedTweet",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            })
            .populate({
                path: "inReplyTo",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        // Get the total count for pagination
        const total = await Tweet.countDocuments({
            inReplyTo: id,
            isDeleted: false,
        });

        // Add bookmarked status if user is authenticated
        let tweetResponse = tweet.toObject();
        let repliesResponse = replies.map((reply) => reply.toObject());
        let parentTweetResponse = null;

        if (req.user) {
            const user = await User.findById(req.user._id);
            const bookmarkedTweetIds = user.bookmarks.map((id) =>
                id.toString()
            );

            // Check if main tweet is bookmarked
            tweetResponse.bookmarked = bookmarkedTweetIds.includes(
                tweet._id.toString()
            );

            // Check if each reply is bookmarked
            repliesResponse = repliesResponse.map((reply) => {
                reply.bookmarked = bookmarkedTweetIds.includes(
                    reply._id.toString()
                );
                return reply;
            });

            // Check if parent tweet (if exists) is bookmarked
            if (tweet.inReplyTo && typeof tweet.inReplyTo === "object") {
                parentTweetResponse = tweet.inReplyTo.toObject();
                parentTweetResponse.bookmarked = bookmarkedTweetIds.includes(
                    parentTweetResponse._id.toString()
                );
            }
        } else if (tweet.inReplyTo && typeof tweet.inReplyTo === "object") {
            parentTweetResponse = tweet.inReplyTo.toObject();
        }

        // Increment impressions
        await Tweet.findByIdAndUpdate(id, {
            $inc: { "analytics.impressions": 1 },
        });

        res.status(200).json({
            status: "success",
            data: {
                tweet: tweetResponse,
                parentTweet: parentTweetResponse || undefined,
                replies: repliesResponse,
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
 * Delete a tweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteTweet = async (req, res) => {
    try {
        const { id } = req.params;

        const tweet = await Tweet.findById(id);

        if (!tweet) {
            return res.status(404).json({
                status: "error",
                message: "Tweet not found",
            });
        }

        // Check if user is the author
        if (tweet.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                status: "error",
                message: "You are not authorized to delete this tweet",
            });
        }

        // Soft delete
        await Tweet.findByIdAndUpdate(id, { isDeleted: true });

        res.status(200).json({
            status: "success",
            message: "Tweet deleted successfully",
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Like a tweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const likeTweet = async (req, res) => {
    try {
        const { id } = req.params;

        const tweet = await Tweet.findById(id);

        if (!tweet || tweet.isDeleted) {
            return res.status(404).json({
                status: "error",
                message: "Tweet not found",
            });
        }

        // Check if user has already liked
        if (tweet.likes.includes(req.user._id)) {
            return res.status(400).json({
                status: "error",
                message: "You have already liked this tweet",
            });
        }

        // Add user to likes array and increment count
        await Tweet.findByIdAndUpdate(id, {
            $push: { likes: req.user._id },
            $inc: { "engagementCount.likes": 1 },
        });

        res.status(200).json({
            status: "success",
            message: "Tweet liked successfully",
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Unlike a tweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const unlikeTweet = async (req, res) => {
    try {
        const { id } = req.params;

        const tweet = await Tweet.findById(id);

        if (!tweet || tweet.isDeleted) {
            return res.status(404).json({
                status: "error",
                message: "Tweet not found",
            });
        }

        // Check if user has liked
        if (!tweet.likes.includes(req.user._id)) {
            return res.status(400).json({
                status: "error",
                message: "You have not liked this tweet",
            });
        }

        // Remove user from likes array and decrement count
        await Tweet.findByIdAndUpdate(id, {
            $pull: { likes: req.user._id },
            $inc: { "engagementCount.likes": -1 },
        });

        res.status(200).json({
            status: "success",
            message: "Tweet unliked successfully",
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Retweet a tweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const retweetTweet = async (req, res) => {
    try {
        const { id } = req.params;

        const tweet = await Tweet.findById(id);

        if (!tweet || tweet.isDeleted) {
            return res.status(404).json({
                status: "error",
                message: "Tweet not found",
            });
        }

        // Check if user has already retweeted
        if (tweet.retweets.includes(req.user._id)) {
            return res.status(400).json({
                status: "error",
                message: "You have already retweeted this tweet",
            });
        }

        // Add user to retweets array and increment count
        await Tweet.findByIdAndUpdate(id, {
            $push: { retweets: req.user._id },
            $inc: { "engagementCount.retweets": 1 },
        });

        res.status(200).json({
            status: "success",
            message: "Tweet retweeted successfully",
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Undo retweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const undoRetweet = async (req, res) => {
    try {
        const { id } = req.params;

        const tweet = await Tweet.findById(id);

        if (!tweet || tweet.isDeleted) {
            return res.status(404).json({
                status: "error",
                message: "Tweet not found",
            });
        }

        // Check if user has retweeted
        if (!tweet.retweets.includes(req.user._id)) {
            return res.status(400).json({
                status: "error",
                message: "You have not retweeted this tweet",
            });
        }

        // Remove user from retweets array and decrement count
        await Tweet.findByIdAndUpdate(id, {
            $pull: { retweets: req.user._id },
            $inc: { "engagementCount.retweets": -1 },
        });

        res.status(200).json({
            status: "success",
            message: "Retweet removed successfully",
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Get user timeline
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTimeline = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const includeReplies = req.query.includeReplies === "true";

        // Get users the authenticated user is following
        const following = req.user.following;
        following.push(req.user._id); // Include user's own tweets

        // Base query
        const baseQuery = {
            author: { $in: following },
            isDeleted: false,
        };

        // If we should exclude replies, add that condition
        if (!includeReplies) {
            baseQuery.inReplyTo = null;
        }

        // Get tweets from followed users and user's own tweets
        const tweets = await Tweet.find(baseQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("author", "username name avatar")
            .populate({
                path: "quotedTweet",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            })
            .populate({
                path: "inReplyTo",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        // Get total count for pagination
        const total = await Tweet.countDocuments(baseQuery);

        // Get user's bookmarks to check if tweets are bookmarked
        const user = await User.findById(req.user._id);
        const bookmarkedTweetIds = user.bookmarks.map((id) => id.toString());

        // Add bookmarked field to each tweet
        const tweetsWithBookmarkStatus = tweets.map((tweet) => {
            const tweetObj = tweet.toObject();
            tweetObj.bookmarked = bookmarkedTweetIds.includes(
                tweet._id.toString()
            );
            return tweetObj;
        });

        res.status(200).json({
            status: "success",
            data: {
                tweets: tweetsWithBookmarkStatus,
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
 * Get tweets liked by a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserLikedTweets = async (req, res) => {
    try {
        const { username } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        // Get tweets that the user has liked
        // First get the IDs of tweets user liked
        const likedTweetIds = await Tweet.find(
            { likes: user._id, isDeleted: false },
            "_id"
        ).lean();

        // Then fetch the full tweet details
        const tweets = await Tweet.find({
            _id: { $in: likedTweetIds.map((t) => t._id) },
            isDeleted: false,
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("author", "username name avatar")
            .populate({
                path: "quotedTweet",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        // Get total count for pagination
        const total = likedTweetIds.length;

        res.status(200).json({
            status: "success",
            data: {
                tweets,
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
 * Get user tweets
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserTweets = async (req, res) => {
    try {
        const { username } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const mediaOnly = req.query.mediaOnly === "true";

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        // Build query
        const query = {
            author: user._id,
            isDeleted: false,
            // If there's a inReplyTo field, it's a reply, not a tweet
            inReplyTo: null,
        };

        // If mediaOnly is true, only get tweets with media
        if (mediaOnly) {
            query["media.0"] = { $exists: true };
        }

        // Get user's tweets
        const tweets = await Tweet.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("author", "username name avatar")
            .populate({
                path: "quotedTweet",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        // Get total count for pagination
        const total = await Tweet.countDocuments(query);

        res.status(200).json({
            status: "success",
            data: {
                tweets,
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
 * Get user replies
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserReplies = async (req, res) => {
    try {
        const { username } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        // Get user's replies
        const tweets = await Tweet.find({
            author: user._id,
            isDeleted: false,
            inReplyTo: { $ne: null }, // Must have inReplyTo field
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("author", "username name avatar")
            .populate({
                path: "inReplyTo",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        // Get total count for pagination
        const total = await Tweet.countDocuments({
            author: user._id,
            isDeleted: false,
            inReplyTo: { $ne: null },
        });

        res.status(200).json({
            status: "success",
            data: {
                tweets,
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
 * Bookmark a tweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const bookmarkTweet = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        // Verify the tweet exists and is not deleted
        const tweet = await Tweet.findOne({ _id: id, isDeleted: false });
        if (!tweet) {
            return res.status(404).json({
                status: "error",
                message: "Tweet not found",
            });
        }

        // Add the tweet to user's bookmarks if not already there
        const updated = await User.findByIdAndUpdate(
            userId,
            { $addToSet: { bookmarks: id } },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        res.status(200).json({
            status: "success",
            message: "Tweet bookmarked successfully",
            bookmarked: true,
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Remove bookmark from a tweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const unbookmarkTweet = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        // Remove the tweet from user's bookmarks
        const updated = await User.findByIdAndUpdate(
            userId,
            { $pull: { bookmarks: id } },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        res.status(200).json({
            status: "success",
            message: "Bookmark removed successfully",
            bookmarked: false,
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

module.exports = {
    createTweet,
    getTweet,
    getTweetThread,
    deleteTweet,
    likeTweet,
    unlikeTweet,
    retweetTweet,
    undoRetweet,
    getTimeline,
    getUserTweets,
    getUserReplies,
    getUserLikedTweets,
    bookmarkTweet,
    unbookmarkTweet,
};
